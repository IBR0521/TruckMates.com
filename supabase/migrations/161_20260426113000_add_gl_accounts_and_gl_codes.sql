-- GL coding foundation for accounting, AP, and settlements.

CREATE TABLE IF NOT EXISTS public.gl_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'revenue', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT gl_accounts_company_code_unique UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gl_accounts_company_id
  ON public.gl_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_type
  ON public.gl_accounts (type);

ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view gl accounts in their company" ON public.gl_accounts;
CREATE POLICY "Users can view gl accounts in their company"
  ON public.gl_accounts
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert gl accounts in their company" ON public.gl_accounts;
CREATE POLICY "Users can insert gl accounts in their company"
  ON public.gl_accounts
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update gl accounts in their company" ON public.gl_accounts;
CREATE POLICY "Users can update gl accounts in their company"
  ON public.gl_accounts
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete gl accounts in their company" ON public.gl_accounts;
CREATE POLICY "Users can delete gl accounts in their company"
  ON public.gl_accounts
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_gl_accounts_updated_at ON public.gl_accounts;
CREATE TRIGGER update_gl_accounts_updated_at
  BEFORE UPDATE ON public.gl_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Attach GL code references to accounting records.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS gl_code TEXT;

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS gl_code TEXT;

ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS gl_code TEXT;

-- QuickBooks mapping by GL code (e.g. {"5000":"123"}).
ALTER TABLE public.company_integrations
  ADD COLUMN IF NOT EXISTS quickbooks_gl_account_mappings JSONB DEFAULT '{}'::jsonb;
