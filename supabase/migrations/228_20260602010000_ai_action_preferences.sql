-- Lightweight preference accumulation (NOT fine-tuning): tallies how often a company approves or
-- rejects a given AI action, optionally scoped to a specific entity, so the assistant can adapt its
-- recommendations (e.g. "this company keeps rejecting auto-assign for driver X — recommend, don't act").
CREATE TABLE IF NOT EXISTS ai_action_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  -- '' when the action is not tied to a specific entity. Stored as NOT NULL DEFAULT '' so the
  -- composite unique index below dedupes reliably (NULLs are distinct in Postgres unique indexes).
  entity_id text NOT NULL DEFAULT '',
  outcome text NOT NULL CHECK (outcome IN ('approved', 'rejected')),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_action_preferences_unique_idx
  ON ai_action_preferences (company_id, tool_name, entity_id, outcome);

CREATE INDEX IF NOT EXISTS ai_action_preferences_company_count_idx
  ON ai_action_preferences (company_id, count DESC);

ALTER TABLE ai_action_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_action_preferences_company_read ON ai_action_preferences;
CREATE POLICY ai_action_preferences_company_read
  ON ai_action_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_action_preferences.company_id
    )
  );

DROP POLICY IF EXISTS ai_action_preferences_service_role_all ON ai_action_preferences;
CREATE POLICY ai_action_preferences_service_role_all
  ON ai_action_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic upsert-increment used by the approve/reject handlers.
CREATE OR REPLACE FUNCTION increment_ai_action_preference(
  p_company_id uuid,
  p_tool_name text,
  p_entity_id text,
  p_outcome text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ai_action_preferences (company_id, tool_name, entity_id, outcome, count, updated_at)
  VALUES (p_company_id, p_tool_name, COALESCE(p_entity_id, ''), p_outcome, 1, now())
  ON CONFLICT (company_id, tool_name, entity_id, outcome)
  DO UPDATE SET count = ai_action_preferences.count + 1, updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION increment_ai_action_preference(uuid, text, text, text) TO service_role;
