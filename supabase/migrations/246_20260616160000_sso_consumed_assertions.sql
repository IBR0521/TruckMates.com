-- Persistent SAML assertion replay protection (Phase 3).

CREATE TABLE IF NOT EXISTS public.sso_consumed_assertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT sso_consumed_assertions_assertion_id_unique UNIQUE (assertion_id)
);

CREATE INDEX IF NOT EXISTS idx_sso_consumed_assertions_company_id ON public.sso_consumed_assertions(company_id);
CREATE INDEX IF NOT EXISTS idx_sso_consumed_assertions_expires_at ON public.sso_consumed_assertions(expires_at);

ALTER TABLE public.sso_consumed_assertions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sso_consumed_assertions FROM authenticated, anon;
GRANT ALL ON public.sso_consumed_assertions TO service_role;
