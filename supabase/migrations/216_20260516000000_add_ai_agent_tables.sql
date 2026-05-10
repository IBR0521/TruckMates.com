CREATE TABLE IF NOT EXISTS ai_automation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  automation_type text NOT NULL,
  level text NOT NULL DEFAULT 'notify',
  enabled boolean NOT NULL DEFAULT true,
  confidence_threshold integer NOT NULL DEFAULT 70,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, automation_type)
);

CREATE TABLE IF NOT EXISTS ai_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  automation_type text NOT NULL,
  level text NOT NULL,
  triggered boolean NOT NULL DEFAULT false,
  confidence integer NOT NULL DEFAULT 0,
  reasoning text,
  action_taken text,
  action_payload jsonb,
  approved boolean,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_pending_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  automation_type text NOT NULL,
  description text NOT NULL,
  confidence integer NOT NULL,
  reasoning text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  resolved_at timestamptz,
  approved boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_automation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pending_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_automation_configs_company_read ON ai_automation_configs;
CREATE POLICY ai_automation_configs_company_read
  ON ai_automation_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_automation_configs.company_id
    )
  );

DROP POLICY IF EXISTS ai_automation_logs_company_read ON ai_automation_logs;
CREATE POLICY ai_automation_logs_company_read
  ON ai_automation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_automation_logs.company_id
    )
  );

DROP POLICY IF EXISTS ai_pending_approvals_company_read ON ai_pending_approvals;
CREATE POLICY ai_pending_approvals_company_read
  ON ai_pending_approvals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_pending_approvals.company_id
    )
  );

DROP POLICY IF EXISTS ai_automation_configs_service_role_all ON ai_automation_configs;
CREATE POLICY ai_automation_configs_service_role_all
  ON ai_automation_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ai_automation_logs_service_role_all ON ai_automation_logs;
CREATE POLICY ai_automation_logs_service_role_all
  ON ai_automation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ai_pending_approvals_service_role_all ON ai_pending_approvals;
CREATE POLICY ai_pending_approvals_service_role_all
  ON ai_pending_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ai_automation_logs_company_created_at_idx
  ON ai_automation_logs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_automation_logs_company_automation_type_idx
  ON ai_automation_logs(company_id, automation_type);

CREATE INDEX IF NOT EXISTS ai_pending_approvals_company_expires_at_pending_idx
  ON ai_pending_approvals(company_id, expires_at)
  WHERE resolved_at IS NULL;
