-- Repeat-lane load templates: reusable load fields per company (no dates/driver assignment).

CREATE TABLE IF NOT EXISTS public.load_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_load_templates_company_id
  ON public.load_templates(company_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_load_templates_company_name
  ON public.load_templates(company_id, lower(name));

ALTER TABLE public.load_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS load_templates_company_select ON public.load_templates;
CREATE POLICY load_templates_company_select
  ON public.load_templates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = load_templates.company_id
    )
  );

DROP POLICY IF EXISTS load_templates_company_insert ON public.load_templates;
CREATE POLICY load_templates_company_insert
  ON public.load_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = load_templates.company_id
    )
  );

DROP POLICY IF EXISTS load_templates_company_update ON public.load_templates;
CREATE POLICY load_templates_company_update
  ON public.load_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = load_templates.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = load_templates.company_id
    )
  );

DROP POLICY IF EXISTS load_templates_company_delete ON public.load_templates;
CREATE POLICY load_templates_company_delete
  ON public.load_templates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = load_templates.company_id
    )
  );

DROP POLICY IF EXISTS load_templates_service_role_all ON public.load_templates;
CREATE POLICY load_templates_service_role_all
  ON public.load_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.load_templates IS
  'Reusable load field snapshots for repeat lanes — excludes dates and driver/truck assignment.';
