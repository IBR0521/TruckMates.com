-- ============================================================================
-- Geofencing Backend Engine (Entry/Exit/Dwell)
-- ============================================================================
-- Purpose:
-- - Maintain per-truck geofence "inside" state
-- - Generate deterministic events in public.zone_visits:
--   - entry: when outside -> inside
--   - exit:  when inside -> outside (includes duration)
--   - dwell: when inside for >= dwell_time_minutes (one per visit)
--
-- How to use:
-- - Run in Supabase SQL editor AFTER:
--   - supabase/geofencing_schema.sql
--   - supabase/postgis_migration.sql (for is_point_in_geofence())
-- - Then the mobile location ingest route calls RPC:
--     select public.process_geofence_point(...)
-- ============================================================================

-- 1) Track current membership state (one row per truck x geofence)
CREATE TABLE IF NOT EXISTS public.geofence_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE CASCADE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,

  -- State
  is_inside BOOLEAN DEFAULT false NOT NULL,
  inside_since TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  dwell_alert_sent BOOLEAN DEFAULT false NOT NULL,

  -- Last point (for debugging / audit)
  last_latitude DECIMAL(10, 8),
  last_longitude DECIMAL(11, 8),
  last_speed DECIMAL(6, 2),
  last_heading DECIMAL(5, 2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CONSTRAINT geofence_states_unique UNIQUE (company_id, geofence_id, truck_id)
);

CREATE INDEX IF NOT EXISTS idx_geofence_states_company_truck ON public.geofence_states(company_id, truck_id);
CREATE INDEX IF NOT EXISTS idx_geofence_states_company_geofence ON public.geofence_states(company_id, geofence_id);
CREATE INDEX IF NOT EXISTS idx_geofence_states_inside ON public.geofence_states(company_id, is_inside);

ALTER TABLE public.geofence_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view geofence states from their company" ON public.geofence_states;
CREATE POLICY "Users can view geofence states from their company"
  ON public.geofence_states
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "System can upsert geofence states for company" ON public.geofence_states;
CREATE POLICY "System can upsert geofence states for company"
  ON public.geofence_states
  FOR ALL
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- 2) Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_geofence_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_geofence_states_updated_at ON public.geofence_states;
CREATE TRIGGER trigger_update_geofence_states_updated_at
  BEFORE UPDATE ON public.geofence_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_geofence_states_updated_at();

-- 3) Backend evaluation: process a single point
-- Notes:
-- - SECURITY DEFINER so it can write zone_visits / geofence_states even when called from API.
-- - Uses existing public.is_point_in_geofence(lat,lng,geofence_id).
CREATE OR REPLACE FUNCTION public.process_geofence_point(
  company_id_param UUID,
  truck_id_param UUID,
  driver_id_param UUID,
  point_lat DECIMAL,
  point_lng DECIMAL,
  point_ts TIMESTAMP WITH TIME ZONE,
  point_speed DECIMAL DEFAULT NULL,
  point_heading DECIMAL DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
  state RECORD;
  now_inside BOOLEAN;
  events JSONB := '[]'::jsonb;
  effective_ts TIMESTAMP WITH TIME ZONE := COALESCE(point_ts, NOW());
  duration_mins INTEGER;
  mins_inside INTEGER;
BEGIN
  IF company_id_param IS NULL OR truck_id_param IS NULL OR point_lat IS NULL OR point_lng IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing required inputs');
  END IF;

  -- Evaluate each active geofence for this company that applies to this truck
  FOR g IN
    SELECT *
    FROM public.geofences
    WHERE company_id = company_id_param
      AND is_active = true
      AND (
        assigned_trucks IS NULL
        OR truck_id_param = ANY(assigned_trucks)
      )
  LOOP
    now_inside := public.is_point_in_geofence(point_lat, point_lng, g.id);

    SELECT *
    INTO state
    FROM public.geofence_states
    WHERE company_id = company_id_param
      AND geofence_id = g.id
      AND truck_id = truck_id_param;

    IF NOT FOUND THEN
      -- Initialize state row
      INSERT INTO public.geofence_states (
        company_id,
        geofence_id,
        truck_id,
        driver_id,
        is_inside,
        inside_since,
        last_seen_at,
        dwell_alert_sent,
        last_latitude,
        last_longitude,
        last_speed,
        last_heading
      ) VALUES (
        company_id_param,
        g.id,
        truck_id_param,
        driver_id_param,
        now_inside,
        CASE WHEN now_inside THEN effective_ts ELSE NULL END,
        effective_ts,
        false,
        point_lat,
        point_lng,
        point_speed,
        point_heading
      );

      IF now_inside THEN
        INSERT INTO public.zone_visits (
          company_id, geofence_id, truck_id, driver_id,
          event_type, latitude, longitude, timestamp,
          entry_timestamp, speed, heading
        ) VALUES (
          company_id_param, g.id, truck_id_param, driver_id_param,
          'entry', point_lat, point_lng, effective_ts,
          effective_ts, point_speed, point_heading
        );
        events := events || jsonb_build_array(jsonb_build_object('type','entry','geofence_id',g.id));
      END IF;

      CONTINUE;
    END IF;

    -- Update last seen + last point
    UPDATE public.geofence_states
    SET
      driver_id = COALESCE(driver_id_param, driver_id),
      last_seen_at = effective_ts,
      last_latitude = point_lat,
      last_longitude = point_lng,
      last_speed = point_speed,
      last_heading = point_heading
    WHERE company_id = company_id_param
      AND geofence_id = g.id
      AND truck_id = truck_id_param;

    -- Transition checks
    IF now_inside = true AND state.is_inside = false THEN
      -- Entry
      UPDATE public.geofence_states
      SET
        is_inside = true,
        inside_since = effective_ts,
        dwell_alert_sent = false
      WHERE company_id = company_id_param
        AND geofence_id = g.id
        AND truck_id = truck_id_param;

      INSERT INTO public.zone_visits (
        company_id, geofence_id, truck_id, driver_id,
        event_type, latitude, longitude, timestamp,
        entry_timestamp, speed, heading
      ) VALUES (
        company_id_param, g.id, truck_id_param, driver_id_param,
        'entry', point_lat, point_lng, effective_ts,
        effective_ts, point_speed, point_heading
      );
      events := events || jsonb_build_array(jsonb_build_object('type','entry','geofence_id',g.id));

    ELSIF now_inside = false AND state.is_inside = true THEN
      -- Exit (duration from inside_since)
      duration_mins := NULL;
      IF state.inside_since IS NOT NULL THEN
        duration_mins := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (effective_ts - state.inside_since)) / 60))::int;
      END IF;

      UPDATE public.geofence_states
      SET
        is_inside = false,
        inside_since = NULL,
        dwell_alert_sent = false
      WHERE company_id = company_id_param
        AND geofence_id = g.id
        AND truck_id = truck_id_param;

      INSERT INTO public.zone_visits (
        company_id, geofence_id, truck_id, driver_id,
        event_type, latitude, longitude, timestamp,
        exit_timestamp, entry_timestamp, duration_minutes, speed, heading
      ) VALUES (
        company_id_param, g.id, truck_id_param, driver_id_param,
        'exit', point_lat, point_lng, effective_ts,
        effective_ts, state.inside_since, duration_mins, point_speed, point_heading
      );
      events := events || jsonb_build_array(jsonb_build_object('type','exit','geofence_id',g.id,'duration_minutes',duration_mins));
    ELSE
      -- Dwell check (only while staying inside)
      IF now_inside = true
        AND state.is_inside = true
        AND COALESCE(g.alert_on_dwell, false) = true
        AND g.dwell_time_minutes IS NOT NULL
        AND state.inside_since IS NOT NULL
        AND state.dwell_alert_sent = false
      THEN
        mins_inside := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (effective_ts - state.inside_since)) / 60))::int;
        IF mins_inside >= g.dwell_time_minutes THEN
          UPDATE public.geofence_states
          SET dwell_alert_sent = true
          WHERE company_id = company_id_param
            AND geofence_id = g.id
            AND truck_id = truck_id_param;

          INSERT INTO public.zone_visits (
            company_id, geofence_id, truck_id, driver_id,
            event_type, latitude, longitude, timestamp,
            entry_timestamp, duration_minutes, speed, heading
          ) VALUES (
            company_id_param, g.id, truck_id_param, driver_id_param,
            'dwell', point_lat, point_lng, effective_ts,
            state.inside_since, mins_inside, point_speed, point_heading
          );
          events := events || jsonb_build_array(jsonb_build_object('type','dwell','geofence_id',g.id,'duration_minutes',mins_inside));
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'events', events);
END;
$$;

COMMENT ON FUNCTION public.process_geofence_point IS
  'Process a single GPS point and emit geofence entry/exit/dwell events into zone_visits; maintains per-truck geofence state in geofence_states.';

-- 4) Permissions
-- Allow authenticated users and service_role to execute the engine.
-- (RLS still applies to underlying tables; function is SECURITY DEFINER for reliable writes.)
GRANT EXECUTE ON FUNCTION public.process_geofence_point(
  UUID,
  UUID,
  UUID,
  DECIMAL,
  DECIMAL,
  TIMESTAMP WITH TIME ZONE,
  DECIMAL,
  DECIMAL
) TO authenticated, service_role;

