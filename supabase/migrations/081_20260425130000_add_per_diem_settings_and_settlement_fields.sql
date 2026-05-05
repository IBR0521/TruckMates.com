-- Per-diem support for settlements and company defaults.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS per_diem_rate NUMERIC(10, 2) DEFAULT 69.00;

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS per_diem_eligible_nights INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_diem_rate_used NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_diem_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
