CREATE TABLE IF NOT EXISTS ai_morning_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  briefing_date date NOT NULL,

  summary text NOT NULL,
  critical_alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  today_outlook jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial_highlights jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,

  context_used text[] NOT NULL DEFAULT ARRAY[]::text[],
  tokens_used integer DEFAULT 0,
  cost_usd numeric(10, 6) DEFAULT 0,
  model text,
  generation_duration_ms integer,

  viewed_at timestamptz,
  dismissed_at timestamptz,
  actioned_items jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_company_date UNIQUE (company_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_morning_briefings_company_date
  ON ai_morning_briefings(company_id, briefing_date DESC);

ALTER TABLE ai_morning_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_morning_briefings_company_select ON ai_morning_briefings;
CREATE POLICY ai_morning_briefings_company_select
  ON ai_morning_briefings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_morning_briefings.company_id
    )
  );

DROP POLICY IF EXISTS ai_morning_briefings_company_update ON ai_morning_briefings;
CREATE POLICY ai_morning_briefings_company_update
  ON ai_morning_briefings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_morning_briefings.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_morning_briefings.company_id
    )
  );

DROP POLICY IF EXISTS ai_morning_briefings_service_insert ON ai_morning_briefings;
CREATE POLICY ai_morning_briefings_service_insert
  ON ai_morning_briefings
  FOR INSERT
  TO service_role
  WITH CHECK (true);
