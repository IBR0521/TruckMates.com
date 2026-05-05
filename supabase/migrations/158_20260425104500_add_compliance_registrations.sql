-- Compliance registrations: UCR / IRP / MCS-150 / Operating Authority.

CREATE TABLE IF NOT EXISTS public.compliance_registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ucr', 'irp', 'mcs150', 'operating_authority')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_renewal', 'expired', 'inactive')),
  filed_date DATE,
  expiry_date DATE NOT NULL,
  state TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_registrations_company_id
  ON public.compliance_registrations (company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_registrations_expiry_date
  ON public.compliance_registrations (expiry_date);
CREATE INDEX IF NOT EXISTS idx_compliance_registrations_type
  ON public.compliance_registrations (type);

ALTER TABLE public.compliance_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view compliance registrations in their company" ON public.compliance_registrations;
CREATE POLICY "Users can view compliance registrations in their company"
  ON public.compliance_registrations
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert compliance registrations in their company" ON public.compliance_registrations;
CREATE POLICY "Users can insert compliance registrations in their company"
  ON public.compliance_registrations
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update compliance registrations in their company" ON public.compliance_registrations;
CREATE POLICY "Users can update compliance registrations in their company"
  ON public.compliance_registrations
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete compliance registrations in their company" ON public.compliance_registrations;
CREATE POLICY "Users can delete compliance registrations in their company"
  ON public.compliance_registrations
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_compliance_registrations_updated_at ON public.compliance_registrations;
CREATE TRIGGER update_compliance_registrations_updated_at
  BEFORE UPDATE ON public.compliance_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
