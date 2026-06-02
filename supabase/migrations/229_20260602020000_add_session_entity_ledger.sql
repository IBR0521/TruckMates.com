-- Compact "session entity ledger": the most recent entities (type + id + label) created or modified
-- by AI tool calls during a conversation. Lets the assistant resolve references like "it" / "that
-- load" without re-parsing tool history. Capped/maintained in application code (most recent 15).
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS session_entities jsonb NOT NULL DEFAULT '[]'::jsonb;
