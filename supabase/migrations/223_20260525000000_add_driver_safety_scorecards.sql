-- Phase C-2: Driver safety scorecards + coaching sessions (foundation for fleet safety programs)

CREATE TABLE IF NOT EXISTS public.driver_safety_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,

  snapshot_date date NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,

  score numeric(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  letter_grade text NOT NULL CHECK (letter_grade IN ('A', 'B', 'C', 'D', 'F')),

  harsh_braking_score numeric(5, 2) NOT NULL DEFAULT 100,
  harsh_acceleration_score numeric(5, 2) NOT NULL DEFAULT 100,
  harsh_cornering_score numeric(5, 2) NOT NULL DEFAULT 100,
  speeding_score numeric(5, 2) NOT NULL DEFAULT 100,
  hos_compliance_score numeric(5, 2) NOT NULL DEFAULT 100,

  total_miles_driven numeric(10, 2) NOT NULL DEFAULT 0,
  harsh_brake_count integer NOT NULL DEFAULT 0,
  harsh_acceleration_count integer NOT NULL DEFAULT 0,
  harsh_cornering_count integer NOT NULL DEFAULT 0,
  speeding_count integer NOT NULL DEFAULT 0,
  hos_violation_count integer NOT NULL DEFAULT 0,

  events_per_1000_miles numeric(8, 3) NOT NULL DEFAULT 0,

  score_change_vs_prior numeric(5, 2),

  fleet_rank integer,
  fleet_total integer,
  fleet_percentile numeric(5, 2),

  data_confidence text NOT NULL DEFAULT 'medium' CHECK (data_confidence IN ('low', 'medium', 'high')),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_driver_safety_snapshot UNIQUE (driver_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_safety_scorecards_company_date
  ON public.driver_safety_scorecards(company_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_safety_scorecards_driver_date
  ON public.driver_safety_scorecards(driver_id, snapshot_date DESC);

ALTER TABLE public.driver_safety_scorecards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_safety_scorecards_company_select ON public.driver_safety_scorecards;
CREATE POLICY driver_safety_scorecards_company_select
  ON public.driver_safety_scorecards FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = driver_safety_scorecards.company_id)
  );

CREATE TABLE IF NOT EXISTS public.driver_coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  coached_by uuid REFERENCES public.users(id) ON DELETE SET NULL,

  session_date date NOT NULL,
  session_type text NOT NULL CHECK (session_type IN (
    'verbal', 'written', 'formal_review', 'recognition', 'follow_up'
  )),

  scorecard_id uuid REFERENCES public.driver_safety_scorecards(id) ON DELETE SET NULL,
  score_at_session numeric(5, 2),

  topics_discussed text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text NOT NULL,
  action_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  follow_up_date date,
  follow_up_completed boolean NOT NULL DEFAULT false,

  related_event_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_coaching_sessions_company_date
  ON public.driver_coaching_sessions(company_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_coaching_sessions_driver_date
  ON public.driver_coaching_sessions(driver_id, session_date DESC);

ALTER TABLE public.driver_coaching_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_coaching_sessions_company_select ON public.driver_coaching_sessions;
CREATE POLICY driver_coaching_sessions_company_select
  ON public.driver_coaching_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = driver_coaching_sessions.company_id)
  );

DROP POLICY IF EXISTS driver_coaching_sessions_company_insert ON public.driver_coaching_sessions;
CREATE POLICY driver_coaching_sessions_company_insert
  ON public.driver_coaching_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = driver_coaching_sessions.company_id)
  );

DROP POLICY IF EXISTS driver_coaching_sessions_company_update ON public.driver_coaching_sessions;
CREATE POLICY driver_coaching_sessions_company_update
  ON public.driver_coaching_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = driver_coaching_sessions.company_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
            AND u.company_id = driver_coaching_sessions.company_id)
  );

DROP TRIGGER IF EXISTS trg_driver_coaching_sessions_updated_at ON public.driver_coaching_sessions;
CREATE TRIGGER trg_driver_coaching_sessions_updated_at
  BEFORE UPDATE ON public.driver_coaching_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Nightly batching: companies with 500+ drivers resume next run until completed for snapshot_date.
CREATE TABLE IF NOT EXISTS public.driver_safety_scorecard_batch_state (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  last_offset integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_scorecard_batch_state_completed ON public.driver_safety_scorecard_batch_state(completed, snapshot_date);

-- On-demand regeneration (1 / company / UTC day)
CREATE TABLE IF NOT EXISTS public.driver_safety_scorecard_ondemand_runs (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, run_date)
);
