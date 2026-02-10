-- Company Invitation Codes Schema
-- Generic invitation codes that expire in 15 minutes
-- Super Admins can generate codes for their company
-- Any employee can use the code during registration

-- Step 1: Create table for generic company invitation codes
CREATE TABLE IF NOT EXISTS public.company_invitation_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  invitation_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 2: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_invitation_codes_code ON public.company_invitation_codes(invitation_code);
CREATE INDEX IF NOT EXISTS idx_company_invitation_codes_company_id ON public.company_invitation_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitation_codes_expires_at ON public.company_invitation_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_company_invitation_codes_used_at ON public.company_invitation_codes(used_at);

-- Step 3: Enable RLS
ALTER TABLE public.company_invitation_codes ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Super Admins can view codes for their company" ON public.company_invitation_codes;
DROP POLICY IF EXISTS "Super Admins can create codes for their company" ON public.company_invitation_codes;
DROP POLICY IF EXISTS "Anyone can check invitation code validity" ON public.company_invitation_codes;

-- Step 5: Create RLS Policies
CREATE POLICY "Super Admins can view codes for their company"
  ON public.company_invitation_codes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super Admins can create codes for their company"
  ON public.company_invitation_codes FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    AND created_by = auth.uid()
  );

-- Allow anyone to check if a code is valid (for registration)
CREATE POLICY "Anyone can check invitation code validity"
  ON public.company_invitation_codes FOR SELECT
  USING (
    invitation_code IS NOT NULL
    AND used_at IS NULL
    AND expires_at > NOW()
  );

-- Step 6: Function to generate a temporary company invitation code
CREATE OR REPLACE FUNCTION generate_company_invitation_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.company_invitation_codes WHERE invitation_code = code) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Function to verify and use company invitation code
CREATE OR REPLACE FUNCTION use_company_invitation_code(
  p_invitation_code TEXT,
  p_user_id UUID,
  p_user_role TEXT
)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_company_id UUID;
BEGIN
  -- Find valid, unused, non-expired code
  SELECT * INTO v_invitation
  FROM public.company_invitation_codes
  WHERE invitation_code = UPPER(p_invitation_code)
    AND used_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  v_company_id := v_invitation.company_id;

  -- Update user to link to company
  UPDATE public.users
  SET 
    company_id = v_company_id,
    role = p_user_role,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Mark code as used
  UPDATE public.company_invitation_codes
  SET 
    used_at = NOW(),
    used_by = p_user_id
  WHERE id = v_invitation.id;

  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_company_invitation_code TO authenticated;
GRANT EXECUTE ON FUNCTION use_company_invitation_code TO authenticated;

