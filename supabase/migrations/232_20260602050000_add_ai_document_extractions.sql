-- Structured extraction for rate confirmations and BOLs, plus discrepancy tracking.
-- Stores extracted fields linked to `documents.id` (company-scoped) so we can compare against
-- loads/invoices and surface discrepancies as notifications.

CREATE TABLE IF NOT EXISTS ai_document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- 'rate_confirmation' | 'bol'
  document_kind text NOT NULL CHECK (document_kind IN ('rate_confirmation', 'bol')),

  -- Structured extracted fields (strict JSON schema enforced at prompt-level; DB stores jsonb).
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(4, 3) NOT NULL DEFAULT 0,
  model text,

  -- Optional links for discrepancy checks.
  load_id uuid REFERENCES loads(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,

  -- Discrepancy findings (derived from extracted + live records).
  discrepancies jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_discrepancy boolean NOT NULL DEFAULT false,

  extracted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_document_extractions_company_doc
  ON ai_document_extractions(company_id, document_id, extracted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ai_document_extractions_company_doc_kind_unique
  ON ai_document_extractions(company_id, document_id, document_kind);

CREATE INDEX IF NOT EXISTS idx_ai_document_extractions_company_discrep
  ON ai_document_extractions(company_id, has_discrepancy, extracted_at DESC);

ALTER TABLE ai_document_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_document_extractions_company_read ON ai_document_extractions;
CREATE POLICY ai_document_extractions_company_read
  ON ai_document_extractions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_document_extractions.company_id
    )
  );

DROP POLICY IF EXISTS ai_document_extractions_service_all ON ai_document_extractions;
CREATE POLICY ai_document_extractions_service_all
  ON ai_document_extractions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

