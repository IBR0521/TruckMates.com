ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_bank_last4 TEXT;

CREATE INDEX IF NOT EXISTS idx_drivers_stripe_account_id
  ON public.drivers (stripe_account_id);

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_eta DATE,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payout_id TEXT;

CREATE INDEX IF NOT EXISTS idx_settlements_payment_reference
  ON public.settlements (payment_reference);
