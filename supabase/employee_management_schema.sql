-- Employee Management Schema
-- Run this in Supabase SQL Editor

-- Add position and status fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS employee_status TEXT DEFAULT 'active'; -- 'active', 'inactive', 'suspended'

-- Create invitation_codes table for employee invitations
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invitation_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_company_id ON public.invitation_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_email ON public.invitation_codes(email);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_status ON public.invitation_codes(status);

-- Enable RLS on invitation_codes
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitation_codes
-- Managers can view invitations for their company
CREATE POLICY "Managers can view invitations for their company"
  ON public.invitation_codes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Managers can create invitations for their company
CREATE POLICY "Managers can create invitations for their company"
  ON public.invitation_codes FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND created_by = auth.uid()
  );

-- Managers can update invitations for their company
CREATE POLICY "Managers can update invitations for their company"
  ON public.invitation_codes FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Managers can delete invitations for their company
CREATE POLICY "Managers can delete invitations for their company"
  ON public.invitation_codes FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Anyone can check if an invitation code is valid (for verification)
CREATE POLICY "Anyone can check invitation code validity"
  ON public.invitation_codes FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Update RLS policies for users table to allow managers to view employees
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can view employees in their company" ON public.users;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Managers can view all users in their company
CREATE POLICY "Managers can view employees in their company"
  ON public.users FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Managers can update employees in their company (but not change role to manager)
CREATE POLICY "Managers can update employees in their company"
  ON public.users FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND id != auth.uid() -- Can't update themselves
    AND role != 'manager' -- Can't update other managers
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND role != 'manager' -- Can't change role to manager
  );

-- Managers can delete employees from their company (but not managers)
CREATE POLICY "Managers can delete employees from their company"
  ON public.users FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
    AND role != 'manager' -- Can't delete managers
    AND id != auth.uid() -- Can't delete themselves
  );

-- Function to generate unique invitation code
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a code like EMP-ABC123XYZ
    code := 'EMP-' || UPPER(substring(md5(random()::text || clock_timestamp()::text) from 1 for 9));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.invitation_codes WHERE invitation_code = code) INTO exists_check;
    
    -- If code doesn't exist, return it
    IF NOT exists_check THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to accept invitation and link user to company
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
  -- Get invitation details
  SELECT * INTO v_invitation
  FROM public.invitation_codes
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  -- Check if invitation exists and is valid
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  -- Get company ID
  v_company_id := v_invitation.company_id;

  -- Update user to link to company
  UPDATE public.users
  SET 
    company_id = v_company_id,
    role = 'user', -- Ensure they're set as user, not manager
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Update invitation status
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;

-- Create trigger for updated_at on invitation_codes
CREATE TRIGGER update_invitation_codes_updated_at 
  BEFORE UPDATE ON public.invitation_codes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

