-- Phase C-5: Engine fault codes — instances, canonical translations, sync cursors.
-- Complements public.eld_diagnostics (raw telemetry) with fleet-wide tracking + resolution.

CREATE TABLE IF NOT EXISTS public.eld_fault_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  eld_device_id uuid REFERENCES public.eld_devices(id) ON DELETE CASCADE,

  code text NOT NULL,
  code_protocol text NOT NULL CHECK (code_protocol IN (
    'OBD2', 'J1939', 'J1708', 'manufacturer', 'unknown'
  )),

  description text,
  severity text NOT NULL DEFAULT 'unknown' CHECK (severity IN (
    'critical', 'high', 'medium', 'low', 'unknown'
  )),
  category text,
  recommended_action text,

  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,

  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes text,
  linked_maintenance_id uuid REFERENCES public.maintenance(id) ON DELETE SET NULL,

  provider text NOT NULL CHECK (provider IN ('samsara', 'motive', 'geotab')),
  provider_fault_id text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  location_lat numeric(10, 6),
  location_lng numeric(10, 6),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_fault_idx
  ON public.eld_fault_codes(truck_id, code, provider)
  WHERE is_active = true AND truck_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eld_fault_codes_company_active
  ON public.eld_fault_codes(company_id, is_active, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_eld_fault_codes_truck
  ON public.eld_fault_codes(truck_id, first_seen_at DESC)
  WHERE truck_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eld_fault_codes_severity
  ON public.eld_fault_codes(company_id, severity, is_active);

ALTER TABLE public.eld_fault_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eld_fault_codes_company_select ON public.eld_fault_codes;
CREATE POLICY eld_fault_codes_company_select
  ON public.eld_fault_codes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_fault_codes.company_id
    )
  );

DROP POLICY IF EXISTS eld_fault_codes_company_update ON public.eld_fault_codes;
CREATE POLICY eld_fault_codes_company_update
  ON public.eld_fault_codes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_fault_codes.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_fault_codes.company_id
    )
  );

CREATE TABLE IF NOT EXISTS public.dtc_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  protocol text NOT NULL CHECK (protocol IN (
    'OBD2', 'J1939', 'J1708', 'manufacturer'
  )),
  manufacturer text,

  short_description text NOT NULL,
  long_description text,
  severity text NOT NULL CHECK (severity IN (
    'critical', 'high', 'medium', 'low'
  )),
  category text NOT NULL,
  recommended_action text NOT NULL,
  estimated_repair_cost_low_usd integer,
  estimated_repair_cost_high_usd integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_translation UNIQUE (code, protocol, manufacturer)
);

CREATE INDEX IF NOT EXISTS idx_dtc_translations_code
  ON public.dtc_translations(code);

ALTER TABLE public.dtc_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dtc_translations_authenticated_read ON public.dtc_translations;
CREATE POLICY dtc_translations_authenticated_read
  ON public.dtc_translations FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.eld_fault_sync_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  last_synced_through timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0,

  CONSTRAINT unique_fault_cursor UNIQUE (company_id, provider)
);

COMMENT ON TABLE public.eld_fault_codes IS
  'Active and historical ECM fault codes per truck; cleared codes remain with is_active=false.';
