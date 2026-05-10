-- Paddle billing columns + subscription tier; sms usage logging for plan enforcement

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'starter'
    CHECK (subscription_tier IN ('owner_operator', 'starter', 'professional', 'fleet', 'enterprise'));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual'));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS paddle_customer_id text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'expired'));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_subscription_tier ON public.companies(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON public.companies(subscription_status);

-- SMS usage meter (outbound / blocked attempts)
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'sent',
  body text,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  phone_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_company_created ON public.sms_logs(company_id, created_at DESC);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Optional: fuel transactions flag for automation (safe if already exists)
ALTER TABLE public.fuel_card_transactions
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;
