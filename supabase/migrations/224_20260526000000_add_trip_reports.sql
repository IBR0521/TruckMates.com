-- Phase C-3: Trip reports — high-volume ELD GPS telemetry + per-load trip summary cache.
--
-- TODO (retention / archival): eld_telemetry_points grows quickly (~720 pts/truck/day at 1–2 min sampling).
--       Recommended: archive or delete telemetry older than 90 days (cold storage or partitioned table).
--       Not implemented in this migration — operational follow-up required.

-- Extend ELD sync cursor types for telemetry ingestion (used by /api/cron/sync-eld-telemetry).
ALTER TABLE public.eld_sync_cursors DROP CONSTRAINT IF EXISTS eld_sync_cursors_data_type_check;
ALTER TABLE public.eld_sync_cursors
  ADD CONSTRAINT eld_sync_cursors_data_type_check CHECK (data_type IN (
    'harsh_events',
    'idle_sessions',
    'telemetry'
  ));

CREATE TABLE IF NOT EXISTS public.eld_telemetry_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  eld_device_id uuid NOT NULL REFERENCES public.eld_devices(id) ON DELETE CASCADE,

  recorded_at timestamptz NOT NULL,

  location_lat numeric(10, 6) NOT NULL,
  location_lng numeric(10, 6) NOT NULL,
  speed_mph numeric(6, 2),
  heading_degrees numeric(5, 2),

  engine_on boolean,
  odometer_miles numeric(10, 2),

  fuel_level_percent numeric(5, 2),

  provider text NOT NULL CHECK (provider IN ('samsara', 'motive', 'geotab')),
  provider_point_id text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eld_telemetry_truck_time
  ON public.eld_telemetry_points(truck_id, recorded_at DESC)
  WHERE truck_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eld_telemetry_company_time
  ON public.eld_telemetry_points(company_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_eld_telemetry_driver_time
  ON public.eld_telemetry_points(driver_id, recorded_at DESC)
  WHERE driver_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eld_telemetry_provider_dedup
  ON public.eld_telemetry_points(provider, provider_point_id)
  WHERE provider_point_id IS NOT NULL;

ALTER TABLE public.eld_telemetry_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eld_telemetry_points_company_select ON public.eld_telemetry_points;
CREATE POLICY eld_telemetry_points_company_select
  ON public.eld_telemetry_points FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = eld_telemetry_points.company_id
    )
  );

CREATE TABLE IF NOT EXISTS public.trip_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  load_id uuid NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,

  trip_started_at timestamptz NOT NULL,
  trip_ended_at timestamptz NOT NULL,

  total_distance_miles numeric(10, 2) NOT NULL DEFAULT 0,
  total_duration_seconds integer NOT NULL DEFAULT 0,
  active_drive_seconds integer NOT NULL DEFAULT 0,
  idle_seconds integer NOT NULL DEFAULT 0,
  stopped_seconds integer NOT NULL DEFAULT 0,

  max_speed_mph numeric(6, 2),
  avg_speed_mph numeric(6, 2),

  harsh_brake_count integer NOT NULL DEFAULT 0,
  harsh_acceleration_count integer NOT NULL DEFAULT 0,
  harsh_cornering_count integer NOT NULL DEFAULT 0,
  speeding_count integer NOT NULL DEFAULT 0,

  estimated_fuel_gallons numeric(8, 2),
  estimated_fuel_cost_usd numeric(10, 2),
  estimated_idle_fuel_gallons numeric(8, 2),

  stops jsonb NOT NULL DEFAULT '[]'::jsonb,

  on_time_pickup boolean,
  on_time_delivery boolean,
  pickup_arrival_at timestamptz,
  delivery_arrival_at timestamptz,

  computed_at timestamptz NOT NULL DEFAULT now(),
  needs_refresh boolean NOT NULL DEFAULT false,

  CONSTRAINT unique_load_trip_summary UNIQUE (load_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_summaries_company_started
  ON public.trip_summaries(company_id, trip_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_summaries_driver
  ON public.trip_summaries(driver_id, trip_started_at DESC)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_summaries_truck
  ON public.trip_summaries(truck_id, trip_started_at DESC)
  WHERE truck_id IS NOT NULL;

ALTER TABLE public.trip_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_summaries_company_select ON public.trip_summaries;
CREATE POLICY trip_summaries_company_select
  ON public.trip_summaries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = trip_summaries.company_id
    )
  );
