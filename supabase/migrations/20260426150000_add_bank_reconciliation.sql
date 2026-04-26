CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  account_name TEXT,
  statement_month DATE,
  file_name TEXT,
  imported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bank_statement_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  statement_import_id UUID REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE NOT NULL,
  txn_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
  matched_entity_type TEXT CHECK (matched_entity_type IN ('expense', 'vendor_invoice_payment')),
  matched_entity_id UUID,
  confidence_score NUMERIC(5,2),
  raw_row JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_stmt_imports_company ON public.bank_statement_imports(company_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_txn_company_status ON public.bank_statement_transactions(company_id, status, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_txn_import ON public.bank_statement_transactions(statement_import_id);

ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bank statement imports in their company" ON public.bank_statement_imports;
CREATE POLICY "Users can view bank statement imports in their company"
  ON public.bank_statement_imports
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert bank statement imports in their company" ON public.bank_statement_imports;
CREATE POLICY "Users can insert bank statement imports in their company"
  ON public.bank_statement_imports
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update bank statement imports in their company" ON public.bank_statement_imports;
CREATE POLICY "Users can update bank statement imports in their company"
  ON public.bank_statement_imports
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete bank statement imports in their company" ON public.bank_statement_imports;
CREATE POLICY "Users can delete bank statement imports in their company"
  ON public.bank_statement_imports
  FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view bank statement txns in their company" ON public.bank_statement_transactions;
CREATE POLICY "Users can view bank statement txns in their company"
  ON public.bank_statement_transactions
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert bank statement txns in their company" ON public.bank_statement_transactions;
CREATE POLICY "Users can insert bank statement txns in their company"
  ON public.bank_statement_transactions
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update bank statement txns in their company" ON public.bank_statement_transactions;
CREATE POLICY "Users can update bank statement txns in their company"
  ON public.bank_statement_transactions
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete bank statement txns in their company" ON public.bank_statement_transactions;
CREATE POLICY "Users can delete bank statement txns in their company"
  ON public.bank_statement_transactions
  FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS update_bank_statement_imports_updated_at ON public.bank_statement_imports;
CREATE TRIGGER update_bank_statement_imports_updated_at
  BEFORE UPDATE ON public.bank_statement_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_statement_transactions_updated_at ON public.bank_statement_transactions;
CREATE TRIGGER update_bank_statement_transactions_updated_at
  BEFORE UPDATE ON public.bank_statement_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
