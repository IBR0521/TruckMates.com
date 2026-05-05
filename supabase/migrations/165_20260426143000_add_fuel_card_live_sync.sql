CREATE TABLE IF NOT EXISTS public.fuel_card_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('comdata', 'wex', 'efs')),
  external_transaction_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  posted_date DATE,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  card_number_last4 TEXT,
  merchant_name TEXT,
  merchant_city TEXT,
  merchant_state TEXT,
  gallons NUMERIC(12,3) NOT NULL DEFAULT 0,
  price_per_gallon NUMERIC(12,4),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  odometer NUMERIC(12,1),
  raw_payload JSONB DEFAULT '{}'::jsonb,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT fuel_card_transactions_company_external_unique UNIQUE (company_id, provider, external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_fuel_card_transactions_company_date
  ON public.fuel_card_transactions (company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_card_transactions_provider
  ON public.fuel_card_transactions (provider);

ALTER TABLE public.fuel_card_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view fuel card transactions in their company" ON public.fuel_card_transactions;
CREATE POLICY "Users can view fuel card transactions in their company"
  ON public.fuel_card_transactions
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert fuel card transactions in their company" ON public.fuel_card_transactions;
CREATE POLICY "Users can insert fuel card transactions in their company"
  ON public.fuel_card_transactions
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update fuel card transactions in their company" ON public.fuel_card_transactions;
CREATE POLICY "Users can update fuel card transactions in their company"
  ON public.fuel_card_transactions
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete fuel card transactions in their company" ON public.fuel_card_transactions;
CREATE POLICY "Users can delete fuel card transactions in their company"
  ON public.fuel_card_transactions
  FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS update_fuel_card_transactions_updated_at ON public.fuel_card_transactions;
CREATE TRIGGER update_fuel_card_transactions_updated_at
  BEFORE UPDATE ON public.fuel_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.company_integrations
  ADD COLUMN IF NOT EXISTS comdata_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comdata_api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS comdata_api_key TEXT,
  ADD COLUMN IF NOT EXISTS comdata_api_secret TEXT,
  ADD COLUMN IF NOT EXISTS wex_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wex_api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS wex_api_key TEXT,
  ADD COLUMN IF NOT EXISTS wex_api_secret TEXT,
  ADD COLUMN IF NOT EXISTS efs_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS efs_api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS efs_api_key TEXT,
  ADD COLUMN IF NOT EXISTS efs_api_secret TEXT,
  ADD COLUMN IF NOT EXISTS fuel_card_last_synced_at TIMESTAMP WITH TIME ZONE;
