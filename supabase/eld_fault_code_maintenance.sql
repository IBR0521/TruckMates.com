-- ============================================================================
-- ELD Fault Code Analysis & Predictive Maintenance
-- ============================================================================
-- Automatically creates maintenance work orders from ELD diagnostic fault codes
-- ============================================================================

-- Step 1: Enhance eld_events table with fault code tracking
ALTER TABLE public.eld_events
  ADD COLUMN IF NOT EXISTS fault_code TEXT,
  ADD COLUMN IF NOT EXISTS fault_code_category TEXT, -- 'engine', 'transmission', 'brakes', 'electrical', 'cooling', 'fuel', 'emissions', 'other'
  ADD COLUMN IF NOT EXISTS fault_code_description TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_created BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_id UUID REFERENCES public.maintenance(id) ON DELETE SET NULL;

-- Create index for faster fault code queries
CREATE INDEX IF NOT EXISTS idx_eld_events_fault_code ON public.eld_events(fault_code) WHERE fault_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eld_events_maintenance_created ON public.eld_events(maintenance_created) WHERE maintenance_created = false;

-- Step 2: Create fault code to maintenance mapping table
CREATE TABLE IF NOT EXISTS public.fault_code_maintenance_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  fault_code TEXT NOT NULL,
  fault_code_category TEXT, -- 'engine', 'transmission', 'brakes', 'electrical', etc.
  service_type TEXT NOT NULL,
  priority TEXT DEFAULT 'high' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  estimated_cost DECIMAL(10, 2),
  estimated_labor_hours DECIMAL(5, 2),
  description TEXT,
  auto_create_maintenance BOOLEAN DEFAULT true,
  schedule_days_ahead INTEGER DEFAULT 0, -- Days to schedule ahead (0 = immediate)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, fault_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fault_code_rules_company_id ON public.fault_code_maintenance_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_fault_code_rules_category ON public.fault_code_maintenance_rules(fault_code_category);
CREATE INDEX IF NOT EXISTS idx_fault_code_rules_auto_create ON public.fault_code_maintenance_rules(auto_create_maintenance) WHERE auto_create_maintenance = true;

-- Step 3: Function to analyze fault code and create maintenance
CREATE OR REPLACE FUNCTION analyze_fault_code_and_create_maintenance(
  p_event_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_event RECORD;
  v_rule RECORD;
  v_maintenance_id UUID;
  v_scheduled_date DATE;
  v_current_mileage INTEGER;
  v_truck RECORD;
BEGIN
  -- Get event details
  SELECT * INTO v_event
  FROM public.eld_events
  WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
  
  -- Skip if maintenance already created
  IF v_event.maintenance_created THEN
    RETURN v_event.maintenance_id;
  END IF;
  
  -- Skip if no fault code
  IF v_event.fault_code IS NULL AND v_event.fault_code_category IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get truck details for mileage
  SELECT * INTO v_truck
  FROM public.trucks
  WHERE id = v_event.truck_id;
  
  v_current_mileage := COALESCE(v_truck.mileage, v_truck.current_mileage, 0);
  
  -- Find matching rule (exact fault code match first, then category match)
  SELECT * INTO v_rule
  FROM public.fault_code_maintenance_rules
  WHERE company_id = v_event.company_id
    AND auto_create_maintenance = true
    AND (
      (fault_code IS NOT NULL AND fault_code = v_event.fault_code) OR
      (fault_code_category IS NOT NULL AND fault_code_category = v_event.fault_code_category)
    )
  ORDER BY 
    CASE 
      WHEN fault_code = v_event.fault_code THEN 1
      WHEN fault_code_category = v_event.fault_code_category THEN 2
      ELSE 3
    END
  LIMIT 1;
  
  -- If no rule found, create a default maintenance for urgent fault codes
  IF NOT FOUND THEN
    -- Only auto-create for critical/urgent events
    IF v_event.severity IN ('critical', 'urgent') THEN
      v_rule := ROW(
        NULL::UUID, -- id
        v_event.company_id, -- company_id
        v_event.fault_code, -- fault_code
        v_event.fault_code_category, -- fault_code_category
        'Diagnostic Repair', -- service_type
        'high', -- priority
        NULL::DECIMAL, -- estimated_cost
        NULL::DECIMAL, -- estimated_labor_hours
        COALESCE(v_event.description, 'Fault code detected: ' || v_event.fault_code), -- description
        true, -- auto_create_maintenance
        0, -- schedule_days_ahead
        NOW(), -- created_at
        NOW() -- updated_at
      )::public.fault_code_maintenance_rules;
    ELSE
      -- Non-critical faults don't auto-create maintenance
      RETURN NULL;
    END IF;
  END IF;
  
  -- Calculate scheduled date
  IF v_rule.schedule_days_ahead > 0 THEN
    v_scheduled_date := CURRENT_DATE + (v_rule.schedule_days_ahead || ' days')::INTERVAL;
  ELSIF v_rule.priority IN ('urgent', 'high') THEN
    v_scheduled_date := CURRENT_DATE; -- Immediate for urgent/high
  ELSE
    v_scheduled_date := CURRENT_DATE + INTERVAL '7 days'; -- 7 days for normal/low
  END IF;
  
  -- Create maintenance record
  INSERT INTO public.maintenance (
    company_id,
    truck_id,
    service_type,
    scheduled_date,
    current_mileage,
    priority,
    estimated_cost,
    notes,
    status
  ) VALUES (
    v_event.company_id,
    v_event.truck_id,
    v_rule.service_type,
    v_scheduled_date,
    v_current_mileage,
    v_rule.priority,
    v_rule.estimated_cost,
    COALESCE(
      v_rule.description,
      format('Auto-created from ELD fault code: %s - %s', 
        COALESCE(v_event.fault_code, 'Unknown'), 
        COALESCE(v_event.description, v_event.title))
    ),
    'scheduled'
  )
  RETURNING id INTO v_maintenance_id;
  
  -- Update event to mark maintenance as created
  UPDATE public.eld_events
  SET 
    maintenance_created = true,
    maintenance_id = v_maintenance_id,
    updated_at = NOW()
  WHERE id = p_event_id;
  
  RETURN v_maintenance_id;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Trigger to auto-analyze fault codes when events are created
CREATE OR REPLACE FUNCTION trigger_analyze_fault_code_on_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Only analyze if fault code exists and maintenance not already created
  IF NEW.fault_code IS NOT NULL AND NOT NEW.maintenance_created THEN
    -- Call analysis function (non-blocking)
    PERFORM analyze_fault_code_and_create_maintenance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_analyze_fault_code ON public.eld_events;
CREATE TRIGGER trigger_auto_analyze_fault_code
  AFTER INSERT ON public.eld_events
  FOR EACH ROW
  WHEN (NEW.fault_code IS NOT NULL)
  EXECUTE FUNCTION trigger_analyze_fault_code_on_event();

-- Step 5: Function to batch analyze pending fault codes
CREATE OR REPLACE FUNCTION batch_analyze_pending_fault_codes(
  p_company_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  processed INTEGER,
  created INTEGER,
  skipped INTEGER
) AS $$
DECLARE
  v_event RECORD;
  v_maintenance_id UUID;
  v_processed INTEGER := 0;
  v_created INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  -- Get pending events with fault codes
  FOR v_event IN
    SELECT * FROM public.eld_events
    WHERE maintenance_created = false
      AND fault_code IS NOT NULL
      AND (p_company_id IS NULL OR company_id = p_company_id)
    ORDER BY event_time DESC
    LIMIT p_limit
  LOOP
    v_processed := v_processed + 1;
    
    BEGIN
      v_maintenance_id := analyze_fault_code_and_create_maintenance(v_event.id);
      
      IF v_maintenance_id IS NOT NULL THEN
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      -- Log error but continue processing
      RAISE WARNING 'Failed to analyze fault code for event %: %', v_event.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_created, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Enable RLS on fault_code_maintenance_rules
ALTER TABLE public.fault_code_maintenance_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view fault code rules in their company" ON public.fault_code_maintenance_rules;
CREATE POLICY "Users can view fault code rules in their company"
  ON public.fault_code_maintenance_rules FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert fault code rules in their company" ON public.fault_code_maintenance_rules;
CREATE POLICY "Users can insert fault code rules in their company"
  ON public.fault_code_maintenance_rules FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update fault code rules in their company" ON public.fault_code_maintenance_rules;
CREATE POLICY "Users can update fault code rules in their company"
  ON public.fault_code_maintenance_rules FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete fault code rules in their company" ON public.fault_code_maintenance_rules;
CREATE POLICY "Users can delete fault code rules in their company"
  ON public.fault_code_maintenance_rules FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Step 7: Add comments
COMMENT ON TABLE public.fault_code_maintenance_rules IS 
  'Maps ELD fault codes to maintenance service types for automatic work order creation';
COMMENT ON FUNCTION analyze_fault_code_and_create_maintenance IS 
  'Analyzes an ELD event with a fault code and automatically creates a maintenance work order if a matching rule exists';
COMMENT ON FUNCTION batch_analyze_pending_fault_codes IS 
  'Batch processes pending ELD events with fault codes to create maintenance work orders';

-- Step 8: Insert default fault code rules (common OBD-II codes)
-- These can be customized per company
INSERT INTO public.fault_code_maintenance_rules (
  company_id,
  fault_code,
  fault_code_category,
  service_type,
  priority,
  estimated_cost,
  description,
  auto_create_maintenance
) VALUES
  -- Engine codes
  (NULL, 'P0300', 'engine', 'Engine Misfire Diagnosis', 'high', 200.00, 'Random/Multiple Cylinder Misfire Detected', true),
  (NULL, 'P0301', 'engine', 'Cylinder 1 Misfire Repair', 'high', 300.00, 'Cylinder 1 Misfire Detected', true),
  (NULL, 'P0171', 'engine', 'Fuel System Service', 'normal', 250.00, 'System Too Lean (Bank 1)', true),
  (NULL, 'P0172', 'engine', 'Fuel System Service', 'normal', 250.00, 'System Too Rich (Bank 1)', true),
  -- Transmission codes
  (NULL, 'P0700', 'transmission', 'Transmission Diagnostic', 'high', 400.00, 'Transmission Control System Malfunction', true),
  (NULL, 'P0715', 'transmission', 'Transmission Sensor Service', 'high', 350.00, 'Input/Turbine Speed Sensor Circuit Malfunction', true),
  -- Brake codes
  (NULL, 'C1201', 'brakes', 'ABS System Service', 'high', 500.00, 'ABS Control Module Malfunction', true),
  (NULL, 'C1234', 'brakes', 'Brake Sensor Service', 'normal', 200.00, 'Left Front Wheel Speed Sensor Circuit', true),
  -- Electrical codes
  (NULL, 'P0562', 'electrical', 'Electrical System Service', 'normal', 150.00, 'System Voltage Low', true),
  (NULL, 'P0563', 'electrical', 'Electrical System Service', 'normal', 150.00, 'System Voltage High', true),
  -- Cooling codes
  (NULL, 'P0128', 'cooling', 'Cooling System Service', 'normal', 200.00, 'Coolant Thermostat Malfunction', true),
  (NULL, 'P0117', 'cooling', 'Cooling System Service', 'high', 250.00, 'Engine Coolant Temperature Sensor Circuit Low', true),
  -- Fuel codes
  (NULL, 'P0191', 'fuel', 'Fuel System Service', 'normal', 300.00, 'Fuel Rail Pressure Sensor Circuit Range/Performance', true),
  (NULL, 'P0087', 'fuel', 'Fuel System Service', 'high', 400.00, 'Fuel Rail/System Pressure Too Low', true)
ON CONFLICT DO NOTHING;


