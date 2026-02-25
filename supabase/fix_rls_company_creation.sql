-- Quick fix: Create SECURITY DEFINER function to bypass RLS for company creation
-- Run this in Supabase SQL Editor to fix the RLS policy error

-- Drop existing function first (if it exists with different return type)
DROP FUNCTION IF EXISTS public.create_company_for_user(TEXT, TEXT, TEXT, UUID, TEXT);

-- Create the function with TEXT return type for JSON serialization
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_user_id UUID,
  p_company_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Insert company (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO public.companies (name, email, phone, company_type)
  VALUES (p_name, p_email, p_phone, p_company_type)
  RETURNING id INTO v_company_id;

  -- Update user record to link to company
  UPDATE public.users
  SET 
    company_id = v_company_id,
    role = 'super_admin',
    full_name = p_name,
    phone = p_phone
  WHERE id = p_user_id;

  -- Return as TEXT to ensure JSON serialization
  RETURN v_company_id::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_for_user(TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

