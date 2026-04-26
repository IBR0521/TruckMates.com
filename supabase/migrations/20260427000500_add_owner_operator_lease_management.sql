-- Owner-Operator Lease Management

CREATE TABLE IF NOT EXISTS public.lease_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  lease_type TEXT NOT NULL CHECK (lease_type IN ('lease-to-own', 'straight_lease')),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  weekly_payment NUMERIC(12,2) NOT NULL CHECK (weekly_payment >= 0),
  start_date DATE NOT NULL,
  end_date DATE,
  remaining_balance NUMERIC(12,2) NOT NULL CHECK (remaining_balance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_agreements_company_driver
  ON public.lease_agreements(company_id, driver_id);

CREATE INDEX IF NOT EXISTS idx_lease_agreements_company_active
  ON public.lease_agreements(company_id, is_active);

CREATE TABLE IF NOT EXISTS public.lease_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lease_agreement_id UUID NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
  settlement_id UUID REFERENCES public.settlements(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  remaining_balance_after NUMERIC(12,2) NOT NULL CHECK (remaining_balance_after >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_payments_company_lease
  ON public.lease_payments(company_id, lease_agreement_id, payment_date DESC);

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS lease_deduction NUMERIC(12,2) DEFAULT 0;
