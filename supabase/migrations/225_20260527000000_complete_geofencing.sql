-- Phase C-4: Complete geofencing — extend existing public.geofences, add telemetry-driven events,
-- detection cursor, truck inside-state, and load_status_history attribution for automation.
--
-- Detection is approximate: ELD points are often 1–2 minutes apart; fast drive-throughs may be missed.

-- ---------------------------------------------------------------------------
-- 1) Extend geofences (existing table uses zone_type, center_latitude/longitude, is_active, alert_on_*)
-- ---------------------------------------------------------------------------
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS geofence_type text NOT NULL DEFAULT 'customer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'geofences_geofence_type_check'
  ) THEN
    ALTER TABLE public.geofences
      ADD CONSTRAINT geofences_geofence_type_check CHECK (
        geofence_type IN (
          'customer', 'pickup', 'delivery', 'yard', 'fuel_stop', 'rest_area', 'other'
        )
      );
  END IF;
END $$;

ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS related_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.geofences.geofence_type IS 'Semantic place type (pickup/delivery/customer/...). Shape geometry remains in zone_type + center_* / polygon_coordinates.';

-- ---------------------------------------------------------------------------
-- 2) load_status_history: system attribution (automation inserts use service role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.load_status_history
  ADD COLUMN IF NOT EXISTS changed_by_system boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.load_status_history.changed_by_system IS 'True when status changed by background automation (e.g. geofence cron), not a user.';

-- ---------------------------------------------------------------------------
-- 3) geofence_events — canonical telemetry-driven enter/exit stream
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  geofence_id uuid NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  load_id uuid REFERENCES public.loads(id) ON DELETE SET NULL,

  event_type text NOT NULL CHECK (event_type IN ('enter', 'exit')),
  occurred_at timestamptz NOT NULL,

  location_lat numeric(10, 6) NOT NULL,
  location_lng numeric(10, 6) NOT NULL,

  paired_event_id uuid REFERENCES public.geofence_events(id) ON DELETE SET NULL,
  dwell_seconds integer,

  triggered_status_update boolean NOT NULL DEFAULT false,
  previous_load_status text,
  new_load_status text,
  triggered_notification_id uuid,

  detention_billing_status text NOT NULL DEFAULT 'none' CHECK (
    detention_billing_status IN ('none', 'candidate', 'reviewed', 'ignored')
  ),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_company_occurred
  ON public.geofence_events(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_truck_occurred
  ON public.geofence_events(truck_id, occurred_at DESC)
  WHERE truck_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence
  ON public.geofence_events(geofence_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_load
  ON public.geofence_events(load_id, occurred_at DESC)
  WHERE load_id IS NOT NULL;

ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geofence_events_company_select ON public.geofence_events;
CREATE POLICY geofence_events_company_select
  ON public.geofence_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = geofence_events.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Per-company telemetry processing cursor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geofence_detection_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  last_processed_telemetry_at timestamptz NOT NULL DEFAULT (now() - interval '1 hour'),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0,
  CONSTRAINT unique_geofence_detection_cursor UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_geofence_detection_cursors_company
  ON public.geofence_detection_cursors(company_id);

ALTER TABLE public.geofence_detection_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geofence_detection_cursors_company_select ON public.geofence_detection_cursors;
CREATE POLICY geofence_detection_cursors_company_select
  ON public.geofence_detection_cursors FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = geofence_detection_cursors.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Truck inside geofence state (dedupe enter events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.truck_geofence_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  geofence_id uuid NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  entered_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  enter_event_id uuid REFERENCES public.geofence_events(id) ON DELETE SET NULL,
  CONSTRAINT unique_truck_geofence_state UNIQUE (truck_id, geofence_id)
);

CREATE INDEX IF NOT EXISTS idx_truck_geofence_state_company
  ON public.truck_geofence_state(company_id, entered_at DESC);

ALTER TABLE public.truck_geofence_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS truck_geofence_state_company_select ON public.truck_geofence_state;
CREATE POLICY truck_geofence_state_company_select
  ON public.truck_geofence_state FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = truck_geofence_state.company_id
    )
  );
