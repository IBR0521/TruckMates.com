-- Factoring: company settings + invoice tracking
-- Run in Supabase SQL editor if columns are missing.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS factoring_company_name TEXT,
  ADD COLUMN IF NOT EXISTS factoring_submission_email TEXT,
  ADD COLUMN IF NOT EXISTS factoring_include_bol BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS factoring_include_rate_conf BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS factoring_include_pod BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS factoring_email_template TEXT,
  ADD COLUMN IF NOT EXISTS factoring_auto_submit BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.company_settings.factoring_company_name IS 'Display name of factoring partner (e.g. RTS Financial)';
COMMENT ON COLUMN public.company_settings.factoring_submission_email IS 'Email address to submit invoice packets';
COMMENT ON COLUMN public.company_settings.factoring_email_template IS 'Plain-text email body; tokens: {COMPANY_NAME},{INVOICE_NUMBER},{LOAD},{CUSTOMER},{AMOUNT},{DOCUMENTS_LIST}';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS factoring_status TEXT,
  ADD COLUMN IF NOT EXISTS factoring_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS factoring_funded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.invoices.factoring_status IS 'null | pending | funded';
