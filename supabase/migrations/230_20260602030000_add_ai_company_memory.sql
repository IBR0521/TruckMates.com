-- Small per-company AI memory store: DISTILLED patterns only (aliases, recurring questions, stable
-- preferences) — never full chat logs. Maintained nightly by the distill-company-memory cron and
-- injected (capped) into chat context so the assistant remembers how each company talks/works.
CREATE TABLE IF NOT EXISTS ai_company_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('alias', 'recurring_question', 'note')),
  key text NOT NULL,
  value text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_company_memory_unique_idx
  ON ai_company_memory (company_id, kind, key);

CREATE INDEX IF NOT EXISTS ai_company_memory_company_hits_idx
  ON ai_company_memory (company_id, hits DESC);

ALTER TABLE ai_company_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_company_memory_company_read ON ai_company_memory;
CREATE POLICY ai_company_memory_company_read
  ON ai_company_memory
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_company_memory.company_id
    )
  );

DROP POLICY IF EXISTS ai_company_memory_service_role_all ON ai_company_memory;
CREATE POLICY ai_company_memory_service_role_all
  ON ai_company_memory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic upsert-increment used by the nightly distillation cron. Re-distilling the same pattern
-- bumps its hit count and refreshes the value, so frequently-confirmed patterns rank highest.
CREATE OR REPLACE FUNCTION upsert_ai_company_memory(
  p_company_id uuid,
  p_kind text,
  p_key text,
  p_value text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO ai_company_memory (company_id, kind, key, value, hits, updated_at)
  VALUES (p_company_id, p_kind, p_key, p_value, 1, now())
  ON CONFLICT (company_id, kind, key)
  DO UPDATE SET hits = ai_company_memory.hits + 1, value = EXCLUDED.value, updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION upsert_ai_company_memory(uuid, text, text, text) TO service_role;
