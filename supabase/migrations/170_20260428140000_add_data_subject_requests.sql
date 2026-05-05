CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_name TEXT,
  requester_email TEXT,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('gdpr', 'ccpa')),
  request_type TEXT NOT NULL CHECK (request_type IN ('access_export', 'deletion', 'rectification', 'restriction')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'rejected', 'cancelled', 'overdue')),
  description TEXT,
  response_notes TEXT,
  verification_status TEXT NOT NULL DEFAULT 'self_authenticated' CHECK (
    verification_status IN ('self_authenticated', 'verified', 'failed')
  ),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  export_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_company_id
  ON public.data_subject_requests(company_id);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_requester
  ON public.data_subject_requests(requester_user_id);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status_due
  ON public.data_subject_requests(status, due_at);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or manager company dsr" ON public.data_subject_requests;
CREATE POLICY "Users can view own or manager company dsr"
  ON public.data_subject_requests FOR SELECT
  USING (
    requester_user_id = auth.uid()
    OR company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'operations_manager', 'manager')
    )
  );

DROP POLICY IF EXISTS "Users can create own dsr" ON public.data_subject_requests;
CREATE POLICY "Users can create own dsr"
  ON public.data_subject_requests FOR INSERT
  WITH CHECK (requester_user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can update dsr" ON public.data_subject_requests;
CREATE POLICY "Managers can update dsr"
  ON public.data_subject_requests FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'operations_manager', 'manager')
    )
  );
