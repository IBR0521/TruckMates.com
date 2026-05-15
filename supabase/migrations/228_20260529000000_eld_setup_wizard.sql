-- Phase C-6: ELD setup wizard — device health columns + provider vehicle mappings.

ALTER TABLE public.eld_devices
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eld_devices_health_status_check'
  ) THEN
    ALTER TABLE public.eld_devices
      ADD CONSTRAINT eld_devices_health_status_check CHECK (
        health_status IN ('healthy', 'degraded', 'auth_failed', 'unknown')
      );
  END IF;
END $$;

ALTER TABLE public.eld_devices
  ADD COLUMN IF NOT EXISTS health_message text,
  ADD COLUMN IF NOT EXISTS auto_discovered_vehicle_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mapped_vehicle_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.eld_vehicle_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  eld_device_id uuid NOT NULL REFERENCES public.eld_devices(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,

  provider_vehicle_id text NOT NULL,
  provider_vehicle_name text,
  provider_vin text,
  provider_license_plate text,

  is_mapped boolean NOT NULL DEFAULT false,
  auto_matched boolean NOT NULL DEFAULT false,
  match_confidence text CHECK (match_confidence IN ('high', 'medium', 'low', 'manual')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_provider_vehicle UNIQUE (eld_device_id, provider_vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_eld_vehicle_mappings_company
  ON public.eld_vehicle_mappings(company_id, is_mapped);
CREATE INDEX IF NOT EXISTS idx_eld_vehicle_mappings_truck
  ON public.eld_vehicle_mappings(truck_id)
  WHERE truck_id IS NOT NULL;

ALTER TABLE public.eld_vehicle_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eld_vehicle_mappings_company_select ON public.eld_vehicle_mappings;
CREATE POLICY eld_vehicle_mappings_company_select
  ON public.eld_vehicle_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_vehicle_mappings.company_id
    )
  );

DROP POLICY IF EXISTS eld_vehicle_mappings_company_insert ON public.eld_vehicle_mappings;
CREATE POLICY eld_vehicle_mappings_company_insert
  ON public.eld_vehicle_mappings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_vehicle_mappings.company_id
    )
  );

DROP POLICY IF EXISTS eld_vehicle_mappings_company_update ON public.eld_vehicle_mappings;
CREATE POLICY eld_vehicle_mappings_company_update
  ON public.eld_vehicle_mappings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_vehicle_mappings.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = eld_vehicle_mappings.company_id
    )
  );

COMMENT ON TABLE public.eld_vehicle_mappings IS
  'Maps provider fleet vehicle IDs to TruckMates trucks for a company ELD connection.';
