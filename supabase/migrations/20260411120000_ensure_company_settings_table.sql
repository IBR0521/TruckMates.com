-- Ensures public.company_settings exists (fixes: "company_settings table does not exist")
-- Run via Supabase migrations or paste into SQL Editor if the table was never created.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,

  load_number_format TEXT DEFAULT 'LOAD-{YEAR}-{SEQUENCE}',
  load_number_sequence INTEGER DEFAULT 1,
  invoice_number_format TEXT DEFAULT 'INV-{YEAR}-{MONTH}-{SEQUENCE}',
  invoice_number_sequence INTEGER DEFAULT 1,
  dispatch_number_format TEXT DEFAULT 'DISP-{YEAR}-{SEQUENCE}',
  dispatch_number_sequence INTEGER DEFAULT 1,
  bol_number_format TEXT DEFAULT 'BOL-{YEAR}-{SEQUENCE}',
  bol_number_sequence INTEGER DEFAULT 1,

  timezone TEXT DEFAULT 'America/New_York',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  time_format TEXT DEFAULT '12h',
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',

  default_payment_terms TEXT DEFAULT 'Net 30',
  invoice_auto_send BOOLEAN DEFAULT false,
  invoice_email_template TEXT,

  default_load_type TEXT DEFAULT 'ftl',
  default_carrier_type TEXT DEFAULT 'dry-van',
  auto_create_route BOOLEAN DEFAULT true,

  default_check_call_interval INTEGER DEFAULT 4,
  check_call_reminder_minutes INTEGER DEFAULT 15,
  require_check_call_at_pickup BOOLEAN DEFAULT true,
  require_check_call_at_delivery BOOLEAN DEFAULT true,

  auto_attach_bol_to_load BOOLEAN DEFAULT false,
  auto_email_bol_to_customer BOOLEAN DEFAULT false,
  document_retention_days INTEGER DEFAULT 365,
  required_documents JSONB DEFAULT '[]'::jsonb,

  bol_auto_generate BOOLEAN DEFAULT false,
  bol_template TEXT,
  bol_required_fields JSONB DEFAULT '[]'::jsonb,

  odometer_validation_enabled BOOLEAN DEFAULT true,
  max_odometer_increase_per_day INTEGER DEFAULT 1000,
  odometer_auto_sync_from_eld BOOLEAN DEFAULT true,

  promiles_enabled BOOLEAN DEFAULT false,
  promiles_api_key TEXT,
  promiles_username TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Factoring columns (app selects these)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS factoring_company_name TEXT,
  ADD COLUMN IF NOT EXISTS factoring_submission_email TEXT,
  ADD COLUMN IF NOT EXISTS factoring_include_bol BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS factoring_include_rate_conf BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS factoring_include_pod BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS factoring_email_template TEXT,
  ADD COLUMN IF NOT EXISTS factoring_auto_submit BOOLEAN DEFAULT false;

ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Extra columns used by settings UI / number formats
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'owner_name') THEN
    ALTER TABLE public.company_settings ADD COLUMN owner_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'dba_name') THEN
    ALTER TABLE public.company_settings ADD COLUMN dba_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'ein_number') THEN
    ALTER TABLE public.company_settings ADD COLUMN ein_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'load_charge_type') THEN
    ALTER TABLE public.company_settings ADD COLUMN load_charge_type TEXT DEFAULT 'per-mile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'miles_calculation_method') THEN
    ALTER TABLE public.company_settings ADD COLUMN miles_calculation_method TEXT DEFAULT 'google-maps';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'fuel_surcharge_method') THEN
    ALTER TABLE public.company_settings ADD COLUMN fuel_surcharge_method TEXT DEFAULT 'percentage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'fuel_surcharge_flat_amount') THEN
    ALTER TABLE public.company_settings ADD COLUMN fuel_surcharge_flat_amount DECIMAL(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'fuel_surcharge_per_mile') THEN
    ALTER TABLE public.company_settings ADD COLUMN fuel_surcharge_per_mile DECIMAL(10, 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_customer') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_customer BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_broker') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_broker BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_on_trip_start') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_on_trip_start BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_at_shipper') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_at_shipper BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_pickup_completed') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_pickup_completed BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_enroute') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_enroute BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_at_consignee') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_at_consignee BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'check_call_notify_dropoff_completed') THEN
    ALTER TABLE public.company_settings ADD COLUMN check_call_notify_dropoff_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON public.company_settings(company_id);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company settings" ON public.company_settings;
CREATE POLICY "Users can view company settings"
  ON public.company_settings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can update company settings" ON public.company_settings;
CREATE POLICY "Managers can update company settings"
  ON public.company_settings FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'operations_manager')
    )
  );

DROP POLICY IF EXISTS "Users can insert company settings for their company" ON public.company_settings;
CREATE POLICY "Users can insert company settings for their company"
  ON public.company_settings FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- One row per company that is missing it
INSERT INTO public.company_settings (company_id)
SELECT c.id
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_settings s WHERE s.company_id = c.id
)
ON CONFLICT (company_id) DO NOTHING;
