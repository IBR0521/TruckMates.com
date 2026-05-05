ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS triumphpay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS triumphpay_api_base_url TEXT,
  ADD COLUMN IF NOT EXISTS triumphpay_api_key TEXT,
  ADD COLUMN IF NOT EXISTS triumphpay_api_secret TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS factoring_provider TEXT,
  ADD COLUMN IF NOT EXISTS factoring_external_id TEXT,
  ADD COLUMN IF NOT EXISTS factoring_reference_number TEXT,
  ADD COLUMN IF NOT EXISTS factoring_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS factoring_last_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS factoring_funded_amount NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_invoices_factoring_provider_status
  ON public.invoices (company_id, factoring_provider, factoring_status);

CREATE INDEX IF NOT EXISTS idx_invoices_factoring_external_id
  ON public.invoices (company_id, factoring_external_id);
