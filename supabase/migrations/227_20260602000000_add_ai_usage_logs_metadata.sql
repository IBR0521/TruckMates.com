-- Optional structured detail for AI usage/audit log rows.
-- Used by the post-generation numeric verification step (feature "numeric_unverified") to record
-- the offending value(s) and the user question for later review, without a dedicated table.
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS metadata jsonb;
