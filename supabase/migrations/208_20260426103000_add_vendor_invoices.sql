-- Accounts Payable: vendor invoices and AP aging source table

CREATE TABLE IF NOT EXISTS public.vendor_invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'overdue')),
  payment_method TEXT,
  paid_date DATE,
  gl_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT vendor_invoices_company_invoice_unique UNIQUE (company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_company_id
  ON public.vendor_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor_id
  ON public.vendor_invoices (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status
  ON public.vendor_invoices (status);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_due_date
  ON public.vendor_invoices (due_date);

ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view vendor invoices in their company" ON public.vendor_invoices;
CREATE POLICY "Users can view vendor invoices in their company"
  ON public.vendor_invoices
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert vendor invoices in their company" ON public.vendor_invoices;
CREATE POLICY "Users can insert vendor invoices in their company"
  ON public.vendor_invoices
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update vendor invoices in their company" ON public.vendor_invoices;
CREATE POLICY "Users can update vendor invoices in their company"
  ON public.vendor_invoices
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete vendor invoices in their company" ON public.vendor_invoices;
CREATE POLICY "Users can delete vendor invoices in their company"
  ON public.vendor_invoices
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_vendor_invoices_updated_at ON public.vendor_invoices;
CREATE TRIGGER update_vendor_invoices_updated_at
  BEFORE UPDATE ON public.vendor_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
