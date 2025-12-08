-- Complete fix using a SECURITY DEFINER function to bypass RLS
-- This is the most reliable solution for registration

-- First, ensure the INSERT policy exists (in case it wasn't created)
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Managers can update their company" ON public.companies;

-- Create a function that can create companies with elevated privileges
CREATE OR REPLACE FUNCTION public.create_company_for_user(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Insert company (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO public.companies (name, email, phone)
  VALUES (p_name, p_email, p_phone)
  RETURNING id INTO v_company_id;

  -- Update user record to link to company
  UPDATE public.users
  SET 
    company_id = v_company_id,
    role = 'manager',
    full_name = p_name,
    phone = p_phone
  WHERE id = p_user_id;

  RETURN v_company_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_for_user TO authenticated;

-- Also create the regular policies (as backup)
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can update their company"
  ON public.companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Verify everything was created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'companies';

SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_company_for_user';

