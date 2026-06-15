-- Ensure IFTA trip sheets and finance tables exist in numbered migrations (idempotent).

CREATE TABLE IF NOT EXISTS public.trip_sheets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  odometer_start NUMERIC(12, 1),
  odometer_end NUMERIC(12, 1),
  origin_state TEXT,
  destination_state TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_sheets_company_id ON public.trip_sheets(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_sheets_trip_date ON public.trip_sheets(trip_date);

CREATE TABLE IF NOT EXISTS public.trip_sheet_state_miles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_sheet_id UUID NOT NULL REFERENCES public.trip_sheets(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL,
  miles_driven NUMERIC(12, 2) NOT NULL CHECK (miles_driven >= 0),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_sheet_state_miles_sheet ON public.trip_sheet_state_miles(trip_sheet_id);

CREATE TABLE IF NOT EXISTS public.company_invoice_taxes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  tax_type TEXT DEFAULT 'percentage',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'all',
  state_codes TEXT[],
  customer_ids UUID[],
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_company_invoice_taxes_company_id ON public.company_invoice_taxes(company_id);

-- Three-way invoice matching (from legacy 206, idempotent)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS matching_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_details JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exception_reason TEXT,
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.invoice_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  bol_id UUID REFERENCES public.bols(id) ON DELETE SET NULL,
  load_match BOOLEAN DEFAULT false,
  bol_match BOOLEAN DEFAULT false,
  amount_match BOOLEAN DEFAULT false,
  customer_match BOOLEAN DEFAULT false,
  load_amount DECIMAL(10, 2),
  invoice_amount DECIMAL(10, 2),
  amount_difference DECIMAL(10, 2),
  amount_tolerance_percent DECIMAL(5, 2) DEFAULT 1.00,
  load_customer_name TEXT,
  invoice_customer_name TEXT,
  exceptions JSONB DEFAULT '[]'::JSONB,
  verification_status TEXT DEFAULT 'pending',
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_verifications_company_id ON public.invoice_verifications(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_invoice_id ON public.invoice_verifications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_load_id ON public.invoice_verifications(load_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_status ON public.invoice_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_invoices_matching_status ON public.invoices(matching_status);
CREATE INDEX IF NOT EXISTS idx_invoices_requires_manual_review ON public.invoices(requires_manual_review) WHERE requires_manual_review = true;
