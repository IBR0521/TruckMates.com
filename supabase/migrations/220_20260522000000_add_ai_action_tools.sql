-- Audit log for AI-initiated tools (Phase B-3)
CREATE TABLE IF NOT EXISTS ai_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES ai_chat_messages(id) ON DELETE SET NULL,

  tool_name text NOT NULL,
  tool_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_output jsonb,

  status text NOT NULL CHECK (status IN (
    'pending_confirmation', 'approved', 'rejected',
    'executed', 'failed', 'auto_executed', 'blocked'
  )),

  required_confirmation boolean NOT NULL DEFAULT true,
  confirmed_at timestamptz,
  executed_at timestamptz,

  error_message text,
  affected_resource_type text,
  affected_resource_id text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_audit_company_created
  ON ai_action_audit(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_action_audit_conversation
  ON ai_action_audit(conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE ai_action_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_action_audit_company_select ON ai_action_audit;
CREATE POLICY ai_action_audit_company_select
  ON ai_action_audit FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()
            AND u.company_id = ai_action_audit.company_id)
  );

DROP POLICY IF EXISTS ai_action_audit_service_role_all ON ai_action_audit;
CREATE POLICY ai_action_audit_service_role_all
  ON ai_action_audit FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE ai_chat_messages
  ADD COLUMN IF NOT EXISTS tool_calls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_results jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_tool_use_id text;
