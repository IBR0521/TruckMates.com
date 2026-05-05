-- Oversize / Overweight Permit Management

CREATE TABLE IF NOT EXISTS public.permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permit_number TEXT NOT NULL,
  issuing_state TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  issued_date DATE,
  expiry_date DATE,
  max_weight NUMERIC(12,2),
  max_height NUMERIC(10,2),
  max_width NUMERIC(10,2),
  max_length NUMERIC(10,2),
  route_restriction TEXT,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_permits_company_number
  ON public.permits(company_id, permit_number);
CREATE INDEX IF NOT EXISTS idx_permits_company_load
  ON public.permits(company_id, load_id);
CREATE INDEX IF NOT EXISTS idx_permits_company_expiry
  ON public.permits(company_id, expiry_date);

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS requires_permit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_requirement_reason TEXT;
