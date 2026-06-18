-- SAML 2.0 SSO configuration per company (Phase 1: storage + admin UI).

CREATE TABLE IF NOT EXISTS public.company_sso_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  idp_entity_id TEXT NOT NULL,
  idp_sso_url TEXT NOT NULL,
  idp_x509_cert TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_sso_config_company_id_unique UNIQUE (company_id),
  CONSTRAINT company_sso_config_email_domain_unique UNIQUE (email_domain)
);

CREATE INDEX IF NOT EXISTS idx_company_sso_config_company_id ON public.company_sso_config(company_id);
CREATE INDEX IF NOT EXISTS idx_company_sso_config_email_domain ON public.company_sso_config(email_domain);
CREATE INDEX IF NOT EXISTS idx_company_sso_config_active ON public.company_sso_config(is_active) WHERE is_active = true;

ALTER TABLE public.company_sso_config ENABLE ROW LEVEL SECURITY;

-- Only super admins on the same company may read/write SSO config.
DROP POLICY IF EXISTS "company_sso_config_select_admin" ON public.company_sso_config;
CREATE POLICY "company_sso_config_select_admin" ON public.company_sso_config
  FOR SELECT
  USING (
    company_id = (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = company_sso_config.company_id
        AND u.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "company_sso_config_insert_admin" ON public.company_sso_config;
CREATE POLICY "company_sso_config_insert_admin" ON public.company_sso_config
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = company_sso_config.company_id
        AND u.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "company_sso_config_update_admin" ON public.company_sso_config;
CREATE POLICY "company_sso_config_update_admin" ON public.company_sso_config
  FOR UPDATE
  USING (
    company_id = (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = company_sso_config.company_id
        AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    company_id = (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = company_sso_config.company_id
        AND u.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "company_sso_config_delete_admin" ON public.company_sso_config;
CREATE POLICY "company_sso_config_delete_admin" ON public.company_sso_config
  FOR DELETE
  USING (
    company_id = (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = company_sso_config.company_id
        AND u.role = 'super_admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_sso_config TO authenticated;
