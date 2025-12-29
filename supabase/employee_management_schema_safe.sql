-- Employee Management Schema (Safe Version)
-- Run this in Supabase SQL Editor
-- This version handles cases where policies/functions might already exist

-- Step 1: Add position and status fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS employee_status TEXT DEFAULT 'active';

-- Step 2: Create invitation_codes table for employee invitations
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invitation_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 3: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_company_id ON public.invitation_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_email ON public.invitation_codes(email);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_status ON public.invitation_codes(status);

-- Step 4: Enable RLS on invitation_codes
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Managers can view invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can create invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can update invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can delete invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Anyone can check invitation code validity" ON public.invitation_codes;

-- Step 6: Create RLS Policies for invitation_codes
CREATE POLICY "Managers can view invitations for their company"
  ON public.invitation_codes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can create invitations for their company"
  ON public.invitation_codes FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Managers can update invitations for their company"
  ON public.invitation_codes FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete invitations for their company"
  ON public.invitation_codes FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Anyone can check invitation code validity"
  ON public.invitation_codes FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Step 7: Update RLS policies for users table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can view employees in their company" ON public.users;
DROP POLICY IF EXISTS "Managers can update employees in their company" ON public.users;
DROP POLICY IF EXISTS "Managers can delete employees from their company" ON public.users;

-- Recreate policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Managers can view employees in their company"
  ON public.users FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update employees in their company"
  ON public.users FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND id != auth.uid()
    AND role != 'manager'
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND role != 'manager'
  );

CREATE POLICY "Managers can delete employees from their company"
  ON public.users FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND role != 'manager'
    AND id != auth.uid()
  );

-- Step 8: Create function to generate unique invitation code
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := 'EMP-' || UPPER(substring(md5(random()::text || clock_timestamp()::text) from 1 for 9));
    SELECT EXISTS(SELECT 1 FROM public.invitation_codes WHERE invitation_code = code) INTO exists_check;
    IF NOT exists_check THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  p_invitation_code TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_company_id UUID;
BEGIN
  SELECT * INTO v_invitation
  FROM public.invitation_codes
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  v_company_id := v_invitation.company_id;

  UPDATE public.users
  SET 
    company_id = v_company_id,
    role = 'user',
    updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE public.invitation_codes
  SET 
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = p_user_id,
    updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN v_company_id;
END;
$$;

-- Step 10: Grant execute permission
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invitation_code TO authenticated;

-- Step 11: Ensure update_updated_at_column function exists (create if not)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 12: Create trigger for updated_at on invitation_codes (drop first if exists)
DROP TRIGGER IF EXISTS update_invitation_codes_updated_at ON public.invitation_codes;
CREATE TRIGGER update_invitation_codes_updated_at 
  BEFORE UPDATE ON public.invitation_codes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

