CREATE TABLE IF NOT EXISTS public.communication_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT communication_threads_target_check CHECK (
    (driver_id IS NOT NULL AND customer_id IS NULL) OR
    (driver_id IS NULL AND customer_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_threads_driver_unique
  ON public.communication_threads(company_id, driver_id)
  WHERE driver_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_threads_customer_unique
  ON public.communication_threads(company_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communication_threads_company_id
  ON public.communication_threads(company_id);

CREATE TABLE IF NOT EXISTS public.communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('sms_outbound', 'sms_inbound', 'email_outbound', 'chat_message', 'status_notification', 'note')
  ),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  source_table TEXT,
  source_id TEXT,
  subject TEXT,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communication_events_thread_occurred
  ON public.communication_events(thread_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_events_company_id
  ON public.communication_events(company_id);

ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view communication threads in their company" ON public.communication_threads;
CREATE POLICY "Users can view communication threads in their company"
  ON public.communication_threads FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create communication threads in their company" ON public.communication_threads;
CREATE POLICY "Users can create communication threads in their company"
  ON public.communication_threads FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update communication threads in their company" ON public.communication_threads;
CREATE POLICY "Users can update communication threads in their company"
  ON public.communication_threads FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view communication events in their company" ON public.communication_events;
CREATE POLICY "Users can view communication events in their company"
  ON public.communication_events FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create communication events in their company" ON public.communication_events;
CREATE POLICY "Users can create communication events in their company"
  ON public.communication_events FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
