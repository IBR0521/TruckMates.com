-- Phase C-1: Harsh driving events + idle sessions from connected ELDs (foundation for scorecards / notifications)

ALTER TABLE public.eld_devices
  ADD COLUMN IF NOT EXISTS provider_auth_error text,
  ADD COLUMN IF NOT EXISTS provider_auth_error_at timestamptz;

CREATE TABLE IF NOT EXISTS public.eld_harsh_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  eld_device_id uuid NOT NULL REFERENCES public.eld_devices(id) ON DELETE CASCADE,

  event_type text NOT NULL CHECK (event_type IN (
    'harsh_brake', 'harsh_acceleration', 'harsh_cornering',
    'speeding', 'mobile_usage', 'seatbelt_violation',
    'following_distance', 'rolling_stop', 'other'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN (
    'low', 'medium', 'high', 'critical'
  )),

  occurred_at timestamptz NOT NULL,
  location_lat numeric(10, 6),
  location_lng numeric(10, 6),
  location_address text,

  speed_mph numeric(6, 2),
  speed_limit_mph numeric(6, 2),
  g_force numeric(4, 2),
  duration_seconds integer,

  provider text NOT NULL CHECK (provider IN ('samsara', 'motive', 'geotab')),
  provider_event_id text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  coaching_note text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_eld_harsh_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_eld_harsh_events_company_occurred
  ON public.eld_harsh_events(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_eld_harsh_events_driver
  ON public.eld_harsh_events(driver_id, occurred_at DESC)
  WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eld_harsh_events_truck
  ON public.eld_harsh_events(truck_id, occurred_at DESC)
  WHERE truck_id IS NOT NULL;

ALTER TABLE public.eld_harsh_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eld_harsh_events_company_select ON public.eld_harsh_events;
CREATE POLICY eld_harsh_events_company_select
  ON public.eld_harsh_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = eld_harsh_events.company_id)
  );

DROP POLICY IF EXISTS eld_harsh_events_company_update ON public.eld_harsh_events;
CREATE POLICY eld_harsh_events_company_update
  ON public.eld_harsh_events FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = eld_harsh_events.company_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = eld_harsh_events.company_id)
  );

CREATE TABLE IF NOT EXISTS public.eld_idle_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  eld_device_id uuid NOT NULL REFERENCES public.eld_devices(id) ON DELETE CASCADE,

  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,

  location_lat numeric(10, 6),
  location_lng numeric(10, 6),
  location_address text,

  estimated_fuel_gallons numeric(8, 3),
  estimated_fuel_cost_usd numeric(10, 2),

  provider text NOT NULL CHECK (provider IN ('samsara', 'motive', 'geotab')),
  provider_session_id text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_eld_idle_provider_session UNIQUE (provider, provider_session_id)
);

CREATE INDEX IF NOT EXISTS idx_eld_idle_sessions_company_started
  ON public.eld_idle_sessions(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_eld_idle_sessions_truck
  ON public.eld_idle_sessions(truck_id, started_at DESC)
  WHERE truck_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eld_idle_sessions_driver
  ON public.eld_idle_sessions(driver_id, started_at DESC)
  WHERE driver_id IS NOT NULL;

ALTER TABLE public.eld_idle_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eld_idle_sessions_company_select ON public.eld_idle_sessions;
CREATE POLICY eld_idle_sessions_company_select
  ON public.eld_idle_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = eld_idle_sessions.company_id)
  );

CREATE OR REPLACE FUNCTION public.update_eld_idle_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_eld_idle_sessions_updated_at ON public.eld_idle_sessions;
CREATE TRIGGER trg_eld_idle_sessions_updated_at
  BEFORE UPDATE ON public.eld_idle_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_eld_idle_sessions_updated_at();

CREATE TABLE IF NOT EXISTS public.eld_sync_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN (
    'harsh_events', 'idle_sessions'
  )),
  last_synced_through timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,

  CONSTRAINT unique_eld_sync_cursor_company_provider_type UNIQUE (company_id, provider, data_type)
);

CREATE INDEX IF NOT EXISTS idx_eld_sync_cursors_company ON public.eld_sync_cursors(company_id);

ALTER TABLE public.eld_sync_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eld_sync_cursors_company_select ON public.eld_sync_cursors;
CREATE POLICY eld_sync_cursors_company_select
  ON public.eld_sync_cursors FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = eld_sync_cursors.company_id)
  );
