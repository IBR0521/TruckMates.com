-- Persist explainability records for AI safety/compliance recommendations (HOS, CSA, inspections, HAZMAT).
-- Stores only this company's relevant data points (no cross-company prompts).

CREATE TABLE IF NOT EXISTS ai_recommendation_explainability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Source of the recommendation
  source text NOT NULL CHECK (source IN ('chat', 'agent')),
  category text NOT NULL CHECK (category IN ('hos', 'csa', 'inspection', 'hazmat', 'other')),

  recommendation text NOT NULL,
  data_points jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_used jsonb NOT NULL DEFAULT '[]'::jsonb,

  model text,
  prompt_version text NOT NULL,
  prompt_hash text NOT NULL,
  confidence numeric(6, 3),

  conversation_id uuid,
  message_id uuid,
  automation_type text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendation_explainability_company_created
  ON ai_recommendation_explainability(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recommendation_explainability_company_category
  ON ai_recommendation_explainability(company_id, category, created_at DESC);

ALTER TABLE ai_recommendation_explainability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_recommendation_explainability_company_read ON ai_recommendation_explainability;
CREATE POLICY ai_recommendation_explainability_company_read
  ON ai_recommendation_explainability
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_recommendation_explainability.company_id
    )
  );

DROP POLICY IF EXISTS ai_recommendation_explainability_service_all ON ai_recommendation_explainability;
CREATE POLICY ai_recommendation_explainability_service_all
  ON ai_recommendation_explainability
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

