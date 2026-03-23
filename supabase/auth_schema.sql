-- ============================================
-- TRUCKMATES AUTHENTICATION SCHEMA
-- ============================================
-- Clean, professional authentication setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'driver',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 2: Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  company_type TEXT DEFAULT NULL, -- 'broker', 'carrier', 'both', or NULL for regular
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 2.1: Add company_type column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'company_type'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN company_type TEXT DEFAULT NULL;
  END IF;
END $$;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);

-- Step 3.1: Create SECURITY DEFINER function to create companies (bypasses RLS)
-- This is needed because RLS policies can block company creation during registration

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

-- Step 4: Create trigger function to auto-create user record
-- BUG-034 FIX: Never trust raw_user_meta_data.role - always default to 'driver'
-- Role escalation must happen via server-side SECURITY DEFINER RPC functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'driver' -- BUG-034 FIX: Hardcoded default, never trust metadata for role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    -- BUG-034 FIX: Never update role from metadata on conflict
    role = users.role; -- Keep existing role, don't update from metadata
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Step 7: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Managers can update their company" ON public.companies;

-- Step 8: Create RLS policies
-- Users can view and update their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Users can view their company
CREATE POLICY "Users can view their company"
  ON public.companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Authenticated users can create companies (for registration)
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Super admins and managers can update their company
CREATE POLICY "Managers can update their company"
  ON public.companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

-- Step 9: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.companies TO authenticated;

