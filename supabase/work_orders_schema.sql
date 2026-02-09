-- ============================================================================
-- Work Orders System
-- ============================================================================
-- Creates work orders from maintenance records for mechanics/vendors
-- ============================================================================

-- Step 1: Create work_orders table
CREATE TABLE IF NOT EXISTS public.work_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  maintenance_id UUID REFERENCES public.maintenance(id) ON DELETE CASCADE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE NOT NULL,
  
  -- Work Order Details
  work_order_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Internal mechanic
  assigned_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL, -- External vendor
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Parts Required
  parts_required JSONB DEFAULT '[]'::JSONB, -- Array of { part_id, part_number, name, quantity, description, unit_cost }
  parts_reserved BOOLEAN DEFAULT false,
  
  -- Labor
  estimated_labor_hours DECIMAL(5, 2),
  actual_labor_hours DECIMAL(5, 2),
  labor_rate DECIMAL(10, 2),
  
  -- Costs
  estimated_total_cost DECIMAL(10, 2),
  actual_total_cost DECIMAL(10, 2),
  parts_cost DECIMAL(10, 2) DEFAULT 0,
  labor_cost DECIMAL(10, 2) DEFAULT 0,
  
  -- Dates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON public.work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_maintenance_id ON public.work_orders(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_truck_id ON public.work_orders(truck_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_work_order_number ON public.work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON public.work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_vendor ON public.work_orders(assigned_vendor_id);

-- Step 3: Function to generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date_prefix TEXT;
  v_sequence INTEGER;
BEGIN
  v_date_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get next sequence for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM public.work_orders
  WHERE work_order_number LIKE 'WO-' || v_date_prefix || '-%';
  
  RETURN 'WO-' || v_date_prefix || '-' || LPAD(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Step 4: Function to create work order from maintenance
CREATE OR REPLACE FUNCTION create_work_order_from_maintenance(
  p_maintenance_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_maintenance RECORD;
  v_work_order_id UUID;
  v_work_order_number TEXT;
BEGIN
  -- Get maintenance details
  SELECT * INTO v_maintenance
  FROM public.maintenance
  WHERE id = p_maintenance_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance record not found: %', p_maintenance_id;
  END IF;
  
  -- Check if work order already exists
  SELECT id INTO v_work_order_id
  FROM public.work_orders
  WHERE maintenance_id = p_maintenance_id
  LIMIT 1;
  
  IF v_work_order_id IS NOT NULL THEN
    RETURN v_work_order_id; -- Already exists
  END IF;
  
  -- Generate work order number
  v_work_order_number := generate_work_order_number();
  
  -- Create work order
  INSERT INTO public.work_orders (
    company_id,
    maintenance_id,
    truck_id,
    work_order_number,
    title,
    description,
    priority,
    estimated_total_cost,
    status
  ) VALUES (
    v_maintenance.company_id,
    v_maintenance.id,
    v_maintenance.truck_id,
    v_work_order_number,
    v_maintenance.service_type,
    v_maintenance.notes,
    v_maintenance.priority,
    v_maintenance.estimated_cost,
    'pending'
  )
  RETURNING id INTO v_work_order_id;
  
  RETURN v_work_order_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Function to check and reserve parts for work order
CREATE OR REPLACE FUNCTION check_and_reserve_parts(
  p_work_order_id UUID
)
RETURNS TABLE (
  part_id UUID,
  part_number TEXT,
  part_name TEXT,
  required_quantity INTEGER,
  available_quantity INTEGER,
  reserved BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_work_order RECORD;
  v_part JSONB;
  v_part_record RECORD;
BEGIN
  -- Get work order
  SELECT * INTO v_work_order
  FROM public.work_orders
  WHERE id = p_work_order_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Skip if already reserved
  IF v_work_order.parts_reserved THEN
    RETURN;
  END IF;
  
  -- Check each required part
  FOR v_part IN SELECT * FROM jsonb_array_elements(v_work_order.parts_required)
  LOOP
    DECLARE
      v_part_id UUID := (v_part->>'part_id')::UUID;
      v_required_qty INTEGER := COALESCE((v_part->>'quantity')::INTEGER, 1);
      v_available_qty INTEGER := 0;
      v_part_number TEXT;
      v_part_name TEXT;
      v_reserved BOOLEAN := false;
      v_message TEXT;
    BEGIN
      -- Get part availability
      SELECT p.quantity, p.part_number, p.name
      INTO v_available_qty, v_part_number, v_part_name
      FROM public.parts p
      WHERE p.id = v_part_id
        AND p.company_id = v_work_order.company_id;
      
      IF NOT FOUND THEN
        v_message := 'Part not found in inventory';
        RETURN QUERY SELECT v_part_id, v_part_number, v_part_name, v_required_qty, 0, false, v_message;
        CONTINUE;
      END IF;
      
      -- Reserve if available
      IF v_available_qty >= v_required_qty THEN
        UPDATE public.parts
        SET quantity = quantity - v_required_qty,
            updated_at = NOW()
        WHERE id = v_part_id;
        
        v_reserved := true;
        v_message := format('Reserved %s units', v_required_qty);
      ELSE
        v_message := format('Insufficient stock: Need %s, have %s', v_required_qty, v_available_qty);
      END IF;
      
      RETURN QUERY SELECT v_part_id, v_part_number, v_part_name, v_required_qty, v_available_qty, v_reserved, v_message;
    END;
  END LOOP;
  
  -- Update work order if all parts reserved
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_work_order.parts_required) AS part
    WHERE (part->>'part_id')::UUID IN (
      SELECT part_id FROM check_and_reserve_parts(p_work_order_id) WHERE NOT reserved
    )
  ) THEN
    UPDATE public.work_orders
    SET parts_reserved = true,
        updated_at = NOW()
    WHERE id = p_work_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Function to complete work order and update maintenance
CREATE OR REPLACE FUNCTION complete_work_order(
  p_work_order_id UUID,
  p_actual_cost DECIMAL DEFAULT NULL,
  p_actual_labor_hours DECIMAL DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_work_order RECORD;
  v_maintenance_id UUID;
BEGIN
  -- Get work order
  SELECT * INTO v_work_order
  FROM public.work_orders
  WHERE id = p_work_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found: %', p_work_order_id;
  END IF;
  
  v_maintenance_id := v_work_order.maintenance_id;
  
  -- Update work order
  UPDATE public.work_orders
  SET 
    status = 'completed',
    completed_at = NOW(),
    actual_total_cost = COALESCE(p_actual_cost, estimated_total_cost),
    actual_labor_hours = COALESCE(p_actual_labor_hours, estimated_labor_hours),
    updated_at = NOW()
  WHERE id = p_work_order_id;
  
  -- Update maintenance record
  UPDATE public.maintenance
  SET 
    status = 'completed',
    completed_date = CURRENT_DATE,
    actual_cost = COALESCE(p_actual_cost, estimated_cost),
    notes = COALESCE(p_notes, notes) || E'\n\nWork Order: ' || v_work_order.work_order_number || ' completed.',
    updated_at = NOW()
  WHERE id = v_maintenance_id;
  
  RETURN v_maintenance_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Enable RLS
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view work orders in their company" ON public.work_orders;
CREATE POLICY "Users can view work orders in their company"
  ON public.work_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert work orders in their company" ON public.work_orders;
CREATE POLICY "Users can insert work orders in their company"
  ON public.work_orders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update work orders in their company" ON public.work_orders;
CREATE POLICY "Users can update work orders in their company"
  ON public.work_orders FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete work orders in their company" ON public.work_orders;
CREATE POLICY "Users can delete work orders in their company"
  ON public.work_orders FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Step 8: Add comments
COMMENT ON TABLE public.work_orders IS 
  'Work orders created from maintenance records for mechanics/vendors to execute repairs';
COMMENT ON FUNCTION create_work_order_from_maintenance IS 
  'Creates a work order from a maintenance record';
COMMENT ON FUNCTION check_and_reserve_parts IS 
  'Checks parts availability and reserves them for a work order';
COMMENT ON FUNCTION complete_work_order IS 
  'Completes a work order and updates the associated maintenance record';



