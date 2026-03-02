-- Fix EIN Atomic Write - Prevent Orphaned Records
-- This creates an RPC function to atomically create EIN and update company settings
-- in a single transaction to prevent orphaned records

CREATE OR REPLACE FUNCTION create_ein_atomic(
  p_company_id UUID,
  p_ein_number TEXT,
  p_generated_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_ein_id UUID;
BEGIN
  -- Insert EIN record
  INSERT INTO public.company_ein_numbers (
    company_id,
    ein_number,
    generated_by
  ) VALUES (
    p_company_id,
    p_ein_number,
    p_generated_by
  )
  RETURNING id INTO v_ein_id;
  
  -- Update company settings with the EIN (atomic within same transaction)
  UPDATE public.company_settings
  SET ein_number = p_ein_number
  WHERE company_id = p_company_id;
  
  -- If company_settings doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (company_id, ein_number)
    VALUES (p_company_id, p_ein_number)
    ON CONFLICT (company_id) DO UPDATE
    SET ein_number = p_ein_number;
  END IF;
  
  RETURN v_ein_id;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, the entire transaction rolls back
    -- No orphaned records possible
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_ein_atomic(UUID, TEXT, UUID) TO authenticated;

