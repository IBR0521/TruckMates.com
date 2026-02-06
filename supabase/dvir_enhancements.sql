-- ============================================================================
-- DVIR Enhancements
-- ============================================================================
-- Automated defect to work order flow
-- Pre-trip vs post-trip logic
-- Audit readiness improvements
-- ============================================================================

-- Step 1: Add columns for work order tracking
ALTER TABLE public.dvir
  ADD COLUMN IF NOT EXISTS work_orders_created JSONB DEFAULT '[]'::JSONB, -- Array of work order IDs created from defects
  ADD COLUMN IF NOT EXISTS requires_pre_trip BOOLEAN DEFAULT true, -- Whether pre-trip is required before operation
  ADD COLUMN IF NOT EXISTS load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL; -- Link to load if DVIR required for load acceptance

-- Step 2: Function to auto-create work orders from DVIR defects
CREATE OR REPLACE FUNCTION create_work_orders_from_dvir_defects(
  p_dvir_id UUID
)
RETURNS TABLE (
  work_order_id UUID,
  defect_component TEXT,
  defect_description TEXT
) AS $$
DECLARE
  v_dvir RECORD;
  v_defect JSONB;
  v_work_order_id UUID;
  v_maintenance_id UUID;
  v_service_type TEXT;
  v_priority TEXT;
BEGIN
  -- Get DVIR details
  SELECT * INTO v_dvir
  FROM public.dvir
  WHERE id = p_dvir_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DVIR not found: %', p_dvir_id;
  END IF;
  
  -- Only process if defects found and not already processed
  IF NOT v_dvir.defects_found OR v_dvir.defects IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if work orders already created
  IF jsonb_array_length(COALESCE(v_dvir.work_orders_created, '[]'::JSONB)) > 0 THEN
    RETURN; -- Already processed
  END IF;
  
  -- Process each defect
  FOR v_defect IN SELECT * FROM jsonb_array_elements(v_dvir.defects)
  LOOP
    -- Skip if defect is already corrected
    IF (v_defect->>'corrected')::BOOLEAN = true THEN
      CONTINUE;
    END IF;
    
    -- Determine service type and priority based on defect
    v_service_type := format('%s Repair', COALESCE(v_defect->>'component', 'Vehicle'));
    v_priority := CASE
      WHEN (v_defect->>'severity')::TEXT = 'critical' THEN 'urgent'
      WHEN (v_defect->>'severity')::TEXT = 'major' THEN 'high'
      ELSE 'normal'
    END;
    
    -- Create maintenance record first
    INSERT INTO public.maintenance (
      company_id,
      truck_id,
      service_type,
      scheduled_date,
      current_mileage,
      priority,
      notes,
      status
    ) VALUES (
      v_dvir.company_id,
      v_dvir.truck_id,
      v_service_type,
      CURRENT_DATE, -- Immediate for critical, can be adjusted
      v_dvir.odometer_reading,
      v_priority,
      format('Auto-created from DVIR defect: %s - %s', 
        v_defect->>'component', 
        v_defect->>'description')
    )
    RETURNING id INTO v_maintenance_id;
    
    -- Create work order from maintenance
    SELECT create_work_order_from_maintenance(v_maintenance_id) INTO v_work_order_id;
    
    -- Update DVIR with work order ID
    UPDATE public.dvir
    SET work_orders_created = COALESCE(work_orders_created, '[]'::JSONB) || jsonb_build_object(
      'work_order_id', v_work_order_id,
      'maintenance_id', v_maintenance_id,
      'defect_component', v_defect->>'component',
      'created_at', NOW()
    )
    WHERE id = p_dvir_id;
    
    RETURN QUERY SELECT 
      v_work_order_id,
      (v_defect->>'component')::TEXT,
      (v_defect->>'description')::TEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Trigger to auto-create work orders when defects are found
CREATE OR REPLACE FUNCTION trigger_create_work_orders_on_dvir_defects()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if defects found and status is 'failed'
  IF NEW.defects_found = true AND NEW.status = 'failed' THEN
    -- Auto-create work orders (non-blocking)
    PERFORM create_work_orders_from_dvir_defects(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_work_orders_on_dvir ON public.dvir;
CREATE TRIGGER trigger_auto_create_work_orders_on_dvir
  AFTER INSERT OR UPDATE OF defects_found, status, defects ON public.dvir
  FOR EACH ROW
  WHEN (NEW.defects_found = true AND NEW.status = 'failed')
  EXECUTE FUNCTION trigger_create_work_orders_on_dvir_defects();

-- Step 4: Function to check if pre-trip DVIR is required for a truck
CREATE OR REPLACE FUNCTION check_pre_trip_dvir_required(
  p_truck_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_pre_trip_date DATE;
  v_truck_status TEXT;
BEGIN
  -- Get truck status
  SELECT status INTO v_truck_status
  FROM public.trucks
  WHERE id = p_truck_id;
  
  -- If truck is not active, no DVIR required
  IF v_truck_status != 'active' THEN
    RETURN false;
  END IF;
  
  -- Check for pre-trip DVIR today
  SELECT MAX(inspection_date) INTO v_last_pre_trip_date
  FROM public.dvir
  WHERE truck_id = p_truck_id
    AND inspection_type = 'pre_trip'
    AND status IN ('passed', 'defects_corrected')
    AND inspection_date = p_date;
  
  -- If no pre-trip today, it's required
  RETURN v_last_pre_trip_date IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Function to get DVIRs for audit PDF generation
CREATE OR REPLACE FUNCTION get_dvirs_for_audit(
  p_company_id UUID,
  p_truck_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  inspection_type TEXT,
  inspection_date DATE,
  inspection_time TIME,
  driver_name TEXT,
  truck_number TEXT,
  status TEXT,
  defects_found BOOLEAN,
  safe_to_operate BOOLEAN,
  defects JSONB,
  location TEXT,
  mileage INTEGER,
  notes TEXT,
  driver_signature_date TIMESTAMP WITH TIME ZONE,
  certified BOOLEAN,
  certified_by_name TEXT,
  certified_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.inspection_type,
    d.inspection_date,
    d.inspection_time,
    dr.name AS driver_name,
    t.truck_number,
    d.status,
    d.defects_found,
    d.safe_to_operate,
    d.defects,
    d.location,
    d.mileage,
    d.notes,
    d.driver_signature_date,
    d.certified,
    u.name AS certified_by_name,
    d.certified_date
  FROM public.dvir d
  LEFT JOIN public.drivers dr ON dr.id = d.driver_id
  LEFT JOIN public.trucks t ON t.id = d.truck_id
  LEFT JOIN public.users u ON u.id = d.certified_by
  WHERE d.company_id = p_company_id
    AND (p_truck_id IS NULL OR d.truck_id = p_truck_id)
    AND (p_start_date IS NULL OR d.inspection_date >= p_start_date)
    AND (p_end_date IS NULL OR d.inspection_date <= p_end_date)
  ORDER BY d.inspection_date DESC, d.inspection_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add index for load_id
CREATE INDEX IF NOT EXISTS idx_dvir_load_id ON public.dvir(load_id);

-- Step 7: Add comments
COMMENT ON FUNCTION create_work_orders_from_dvir_defects IS 
  'Automatically creates work orders from DVIR defects';
COMMENT ON FUNCTION check_pre_trip_dvir_required IS 
  'Checks if a pre-trip DVIR is required for a truck on a given date';
COMMENT ON FUNCTION get_dvirs_for_audit IS 
  'Retrieves DVIRs formatted for audit PDF generation';
