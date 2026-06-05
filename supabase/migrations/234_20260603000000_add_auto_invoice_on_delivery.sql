-- Opt-in: automatically draft invoices when a load is delivered / POD captured (default OFF).
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS auto_invoice_on_delivery BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.company_settings.auto_invoice_on_delivery IS
  'When true, draft an invoice (never auto-sent) when a load is marked delivered or POD is captured.';
