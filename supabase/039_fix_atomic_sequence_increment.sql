-- Fix Atomic Sequence Increment for Number Generation
-- This creates RPC functions for atomic sequence increment to prevent race conditions
-- when generating load, invoice, dispatch, and BOL numbers concurrently

-- Function to atomically increment load number sequence
CREATE OR REPLACE FUNCTION increment_load_number_sequence(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  UPDATE public.company_settings
  SET load_number_sequence = load_number_sequence + 1
  WHERE company_id = p_company_id
  RETURNING load_number_sequence INTO v_sequence;
  
  IF v_sequence IS NULL THEN
    -- Company settings don't exist, create them
    INSERT INTO public.company_settings (company_id, load_number_sequence)
    VALUES (p_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
    SET load_number_sequence = company_settings.load_number_sequence + 1
    RETURNING load_number_sequence INTO v_sequence;
  END IF;
  
  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment invoice number sequence
CREATE OR REPLACE FUNCTION increment_invoice_number_sequence(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  UPDATE public.company_settings
  SET invoice_number_sequence = invoice_number_sequence + 1
  WHERE company_id = p_company_id
  RETURNING invoice_number_sequence INTO v_sequence;
  
  IF v_sequence IS NULL THEN
    INSERT INTO public.company_settings (company_id, invoice_number_sequence)
    VALUES (p_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
    SET invoice_number_sequence = company_settings.invoice_number_sequence + 1
    RETURNING invoice_number_sequence INTO v_sequence;
  END IF;
  
  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment dispatch number sequence
CREATE OR REPLACE FUNCTION increment_dispatch_number_sequence(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  UPDATE public.company_settings
  SET dispatch_number_sequence = dispatch_number_sequence + 1
  WHERE company_id = p_company_id
  RETURNING dispatch_number_sequence INTO v_sequence;
  
  IF v_sequence IS NULL THEN
    INSERT INTO public.company_settings (company_id, dispatch_number_sequence)
    VALUES (p_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
    SET dispatch_number_sequence = company_settings.dispatch_number_sequence + 1
    RETURNING dispatch_number_sequence INTO v_sequence;
  END IF;
  
  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically increment BOL number sequence
CREATE OR REPLACE FUNCTION increment_bol_number_sequence(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_sequence INTEGER;
BEGIN
  UPDATE public.company_settings
  SET bol_number_sequence = bol_number_sequence + 1
  WHERE company_id = p_company_id
  RETURNING bol_number_sequence INTO v_sequence;
  
  IF v_sequence IS NULL THEN
    INSERT INTO public.company_settings (company_id, bol_number_sequence)
    VALUES (p_company_id, 1)
    ON CONFLICT (company_id) DO UPDATE
    SET bol_number_sequence = company_settings.bol_number_sequence + 1
    RETURNING bol_number_sequence INTO v_sequence;
  END IF;
  
  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_load_number_sequence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_invoice_number_sequence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_dispatch_number_sequence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_bol_number_sequence(UUID) TO authenticated;

