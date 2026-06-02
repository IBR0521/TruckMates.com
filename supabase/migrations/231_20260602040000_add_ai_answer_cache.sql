-- Short-TTL answer cache for READ-ONLY AI chat questions. Keyed on (company_id, normalized question,
-- context-version hash). Only pure read-only answers (no tool mutations) are stored. Invalidation is
-- lazy: bumping a context type's version changes the hash so stale keys simply miss, and rows expire
-- via TTL. Strictly company-scoped — answers are never shared across companies.

-- Per-(company, context_type) version counter. Bumping it invalidates any cached answer that was
-- keyed against the prior version of that context (e.g. invoice write bumps 'financial').
CREATE TABLE IF NOT EXISTS ai_context_versions (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  context_type text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, context_type)
);

CREATE TABLE IF NOT EXISTS ai_answer_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  question text NOT NULL,
  context_types text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  context_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_answer_cache_company_key_idx
  ON ai_answer_cache (company_id, cache_key);
CREATE INDEX IF NOT EXISTS ai_answer_cache_expires_idx
  ON ai_answer_cache (expires_at);

ALTER TABLE ai_context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_answer_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_context_versions_company_read ON ai_context_versions;
CREATE POLICY ai_context_versions_company_read
  ON ai_context_versions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.company_id = ai_context_versions.company_id)
  );

DROP POLICY IF EXISTS ai_context_versions_service_all ON ai_context_versions;
CREATE POLICY ai_context_versions_service_all
  ON ai_context_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ai_answer_cache_company_read ON ai_answer_cache;
CREATE POLICY ai_answer_cache_company_read
  ON ai_answer_cache FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.company_id = ai_answer_cache.company_id)
  );

DROP POLICY IF EXISTS ai_answer_cache_service_all ON ai_answer_cache;
CREATE POLICY ai_answer_cache_service_all
  ON ai_answer_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic bump used by write paths to invalidate a context type for a company.
CREATE OR REPLACE FUNCTION bump_ai_context_version(
  p_company_id uuid,
  p_context_type text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ai_context_versions (company_id, context_type, version, updated_at)
  VALUES (p_company_id, p_context_type, 1, now())
  ON CONFLICT (company_id, context_type)
  DO UPDATE SET version = ai_context_versions.version + 1, updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION bump_ai_context_version(uuid, text) TO service_role;
