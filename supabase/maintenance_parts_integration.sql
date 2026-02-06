-- ============================================================================
-- Maintenance Parts Inventory Integration
-- ============================================================================
-- Links parts inventory with maintenance workflow
-- ============================================================================

-- Step 1: Add parts tracking to maintenance table
ALTER TABLE public.maintenance
  ADD COLUMN IF NOT EXISTS parts_used JSONB DEFAULT '[]'::JSONB; -- Array of { part_id, part_number, name, quantity, unit_cost, total_cost }

-- Step 2: Function to record parts usage from work order
CREATE OR REPLACE FUNCTION record_parts_usage_from_work_order(
  p_work_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_work_order RECORD;
  v_part JSONB;
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
  
  -- Record each part used
  FOR v_part IN SELECT * FROM jsonb_array_elements(v_work_order.parts_required)
  LOOP
    DECLARE
      v_part_id UUID := (v_part->>'part_id')::UUID;
      v_quantity INTEGER := COALESCE((v_part->>'quantity')::INTEGER, 1);
      v_unit_cost DECIMAL(10, 2) := COALESCE((v_part->>'unit_cost')::DECIMAL, 0);
      v_total_cost DECIMAL(10, 2) := v_quantity * v_unit_cost;
      v_part_record RECORD;
    BEGIN
      -- Get part details
      SELECT part_number, name, cost
      INTO v_part_record
      FROM public.parts
      WHERE id = v_part_id;
      
      -- Create part_usage record
      INSERT INTO public.part_usage (
        company_id,
        part_id,
        maintenance_id,
        quantity_used,
        date,
        notes
      ) VALUES (
        v_work_order.company_id,
        v_part_id,
        v_maintenance_id,
        v_quantity,
        CURRENT_DATE,
        format('Used in work order: %s', v_work_order.work_order_number)
      )
      ON CONFLICT DO NOTHING;
      
      -- Update maintenance.parts_used JSONB
      UPDATE public.maintenance
      SET parts_used = COALESCE(parts_used, '[]'::JSONB) || jsonb_build_object(
        'part_id', v_part_id,
        'part_number', COALESCE(v_part_record.part_number, ''),
        'name', COALESCE(v_part_record.name, ''),
        'quantity', v_quantity,
        'unit_cost', v_unit_cost,
        'total_cost', v_total_cost
      ),
      updated_at = NOW()
      WHERE id = v_maintenance_id;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Function to check low stock alerts for parts used in maintenance
CREATE OR REPLACE FUNCTION check_low_stock_for_maintenance_parts(
  p_company_id UUID
)
RETURNS TABLE (
  part_id UUID,
  part_number TEXT,
  part_name TEXT,
  current_quantity INTEGER,
  min_quantity INTEGER,
  maintenance_count INTEGER -- Number of pending maintenance that need this part
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.part_number,
    p.name,
    p.quantity,
    p.min_quantity,
    COUNT(DISTINCT wo.id)::INTEGER as maintenance_count
  FROM public.parts p
  LEFT JOIN public.work_orders wo ON (
    wo.company_id = p.company_id
    AND wo.status IN ('pending', 'in_progress', 'waiting_parts')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(wo.parts_required) AS part
      WHERE (part->>'part_id')::UUID = p.id
    )
  )
  WHERE p.company_id = p_company_id
    AND p.quantity <= p.min_quantity
  GROUP BY p.id, p.part_number, p.name, p.quantity, p.min_quantity
  ORDER BY p.quantity ASC, maintenance_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Function to auto-create part orders when stock is low
CREATE OR REPLACE FUNCTION auto_create_part_orders_for_low_stock(
  p_company_id UUID,
  p_reorder_quantity_multiplier DECIMAL DEFAULT 2.0 -- Order 2x min_quantity
)
RETURNS TABLE (
  part_id UUID,
  part_number TEXT,
  order_id UUID,
  quantity_ordered INTEGER
) AS $$
DECLARE
  v_part RECORD;
  v_order_id UUID;
  v_reorder_qty INTEGER;
BEGIN
  -- Get all low stock parts
  FOR v_part IN
    SELECT * FROM check_low_stock_for_maintenance_parts(p_company_id)
  LOOP
    -- Calculate reorder quantity
    v_reorder_qty := GREATEST(
      CEIL(v_part.min_quantity * p_reorder_quantity_multiplier)::INTEGER,
      v_part.min_quantity * 2 -- At least 2x min quantity
    );
    
    -- Check if order already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.part_orders
      WHERE part_id = v_part.part_id
        AND company_id = p_company_id
        AND status IN ('pending', 'ordered')
    ) THEN
      -- Create part order
      INSERT INTO public.part_orders (
        company_id,
        part_id,
        quantity,
        order_date,
        status,
        notes
      ) VALUES (
        p_company_id,
        v_part.part_id,
        v_reorder_qty,
        CURRENT_DATE,
        'pending',
        format('Auto-created: Low stock alert (Current: %s, Min: %s)', 
          v_part.current_quantity, v_part.min_quantity)
      )
      RETURNING id INTO v_order_id;
      
      RETURN QUERY SELECT v_part.part_id, v_part.part_number, v_order_id, v_reorder_qty;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Trigger to check low stock when parts are used
CREATE OR REPLACE FUNCTION trigger_check_low_stock_on_part_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_part RECORD;
BEGIN
  -- Get part details
  SELECT * INTO v_part
  FROM public.parts
  WHERE id = NEW.part_id;
  
  -- If quantity is now at or below min_quantity, we could trigger an alert
  -- This is handled by the application layer for now
  -- Could add a notification table here if needed
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_low_stock_on_part_usage ON public.part_usage;
CREATE TRIGGER trigger_check_low_stock_on_part_usage
  AFTER INSERT OR UPDATE ON public.part_usage
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_low_stock_on_part_usage();

-- Step 6: Add comments
COMMENT ON FUNCTION record_parts_usage_from_work_order IS 
  'Records parts usage from a completed work order and updates maintenance record';
COMMENT ON FUNCTION check_low_stock_for_maintenance_parts IS 
  'Checks for low stock parts that are needed for pending maintenance work orders';
COMMENT ON FUNCTION auto_create_part_orders_for_low_stock IS 
  'Automatically creates part orders when stock falls below minimum threshold';


