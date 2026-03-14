-- Create invitation_codes table (required for Settings > Users > Invite)
-- Run once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / DROP IF EXISTS).

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

CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_company_id ON public.invitation_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_email ON public.invitation_codes(email);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_status ON public.invitation_codes(status);

ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can create invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can update invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Managers can delete invitations for their company" ON public.invitation_codes;
DROP POLICY IF EXISTS "Anyone can check invitation code validity" ON public.invitation_codes;

CREATE POLICY "Managers can view invitations for their company"
  ON public.invitation_codes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin','operations_manager')
    )
  );

CREATE POLICY "Managers can create invitations for their company"
  ON public.invitation_codes FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin','operations_manager')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Managers can update invitations for their company"
  ON public.invitation_codes FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin','operations_manager')
    )
  );

CREATE POLICY "Managers can delete invitations for their company"
  ON public.invitation_codes FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin','operations_manager')
    )
  );

CREATE POLICY "Anyone can check invitation code validity"
  ON public.invitation_codes FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

CREATE OR REPLACE FUNCTION update_invitation_codes_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invitation_codes_updated_at ON public.invitation_codes;
CREATE TRIGGER update_invitation_codes_updated_at
  BEFORE UPDATE ON public.invitation_codes
  FOR EACH ROW EXECUTE FUNCTION update_invitation_codes_updated_at_column();
