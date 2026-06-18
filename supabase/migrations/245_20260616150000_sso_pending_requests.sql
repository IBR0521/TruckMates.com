-- Pending SAML AuthnRequest IDs for InResponseTo correlation (Phase 2).

CREATE TABLE IF NOT EXISTS public.sso_pending_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sso_pending_requests_request_id_unique UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_sso_pending_requests_created_at ON public.sso_pending_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_sso_pending_requests_email_domain ON public.sso_pending_requests(email_domain);

ALTER TABLE public.sso_pending_requests ENABLE ROW LEVEL SECURITY;

-- Server-only table: no authenticated policies; API routes use service role.
REVOKE ALL ON public.sso_pending_requests FROM authenticated, anon;
GRANT ALL ON public.sso_pending_requests TO service_role;
