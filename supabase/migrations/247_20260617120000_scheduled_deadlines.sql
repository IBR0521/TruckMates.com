-- Deadline tracking for HOS, detention, and delivery delay (replaces full-scan crons).

CREATE TABLE IF NOT EXISTS public.scheduled_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('driver_hos', 'load_detention', 'load_delivery')
  ),
  entity_id UUID NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  deadline_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_deadlines_entity_unique UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_deadlines_status_deadline
  ON public.scheduled_deadlines (status, deadline_at);

ALTER TABLE public.scheduled_deadlines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.scheduled_deadlines FROM authenticated, anon;
GRANT ALL ON public.scheduled_deadlines TO service_role;

-- Lightweight cron overlap guard (service_role only).
CREATE TABLE IF NOT EXISTS public.cron_job_locks (
  job_name TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cron_job_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_job_locks FROM authenticated, anon;
GRANT ALL ON public.cron_job_locks TO service_role;
