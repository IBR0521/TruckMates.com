-- Fix Payment Method Default Swap - Atomic Transaction
-- This creates an RPC function to atomically swap payment method defaults
-- to prevent TOCTOU race conditions

CREATE OR REPLACE FUNCTION set_payment_method_default(
  p_company_id UUID,
  p_payment_method_id UUID,
  p_is_default BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  -- Use a single transaction to atomically:
  -- 1. Unset all existing defaults
  -- 2. Set the new default (if requested)
  
  IF p_is_default THEN
    -- First, unset all defaults for this company
    UPDATE public.company_payment_methods
    SET is_default = false
    WHERE company_id = p_company_id
      AND is_default = true
      AND id != p_payment_method_id;
    
    -- Then set this one as default
    UPDATE public.company_payment_methods
    SET is_default = true
    WHERE id = p_payment_method_id
      AND company_id = p_company_id;
    
    -- Check if the update affected at least one row
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
  ELSE
    -- Just unset this one
    UPDATE public.company_payment_methods
    SET is_default = false
    WHERE id = p_payment_method_id
      AND company_id = p_company_id;
    
    -- Check if the update affected at least one row
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_payment_method_default(UUID, UUID, BOOLEAN) TO authenticated;

