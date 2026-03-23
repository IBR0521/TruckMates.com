-- ============================================================================
-- Update Company During Setup (Bypasses RLS)
-- ============================================================================
-- This function allows users to update their company during setup
-- It bypasses RLS to ensure setup can complete even if role isn't fully set
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_company_for_setup(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_company_for_setup(
  p_company_id UUID,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_exists BOOLEAN;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify the company exists and belongs to the user
  SELECT EXISTS(
    SELECT 1 FROM public.companies c
    INNER JOIN public.users u ON u.company_id = c.id
    WHERE c.id = p_company_id
      AND u.id = v_user_id
  ) INTO v_company_exists;

  IF NOT v_company_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found or access denied');
  END IF;

  -- Update company (bypasses RLS because of SECURITY DEFINER)
  UPDATE public.companies
  SET 
    address = COALESCE(p_address, address),
    phone = COALESCE(p_phone, phone),
    email = COALESCE(p_email, email),
    updated_at = NOW()
  WHERE id = p_company_id;

  -- Return success
  RETURN jsonb_build_object('success', true, 'company_id', p_company_id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_company_for_setup(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_company_for_setup IS 
  'Updates company information during setup. Bypasses RLS to ensure setup can complete.';

