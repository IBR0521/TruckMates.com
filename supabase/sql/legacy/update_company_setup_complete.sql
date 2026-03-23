-- ============================================================================
-- Update Company Setup Complete (Bypasses RLS)
-- ============================================================================
-- This function allows users to mark their company setup as complete
-- It bypasses RLS to ensure setup can complete even if role isn't fully set
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_company_setup_complete(UUID);

CREATE OR REPLACE FUNCTION public.update_company_setup_complete(
  p_company_id UUID
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
    setup_complete = true,
    setup_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_company_id;

  -- Return success
  RETURN jsonb_build_object('success', true, 'company_id', p_company_id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_company_setup_complete(UUID) TO authenticated;

COMMENT ON FUNCTION public.update_company_setup_complete IS 
  'Marks company setup as complete. Bypasses RLS to ensure setup can complete.';

