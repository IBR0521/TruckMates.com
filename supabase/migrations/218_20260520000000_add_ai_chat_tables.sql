CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  context_summary text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Older databases may already have public.ai_conversations (e.g. legacy AI/thread tables).
-- CREATE TABLE IF NOT EXISTS does not add columns; ensure this app’s columns exist before indexes.
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'New conversation',
  ADD COLUMN IF NOT EXISTS context_summary text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ai_conversations_company_user
  ON ai_conversations(company_id, user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  context_used text[] DEFAULT ARRAY[]::text[],
  tokens_used integer DEFAULT 0,
  cost_usd numeric(10, 6) DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation
  ON ai_chat_messages(conversation_id, created_at);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated: own conversations in own company
DROP POLICY IF EXISTS ai_conversations_owner_select ON ai_conversations;
CREATE POLICY ai_conversations_owner_select
  ON ai_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_conversations.company_id
    )
    AND ai_conversations.user_id = auth.uid()
  );

DROP POLICY IF EXISTS ai_conversations_owner_insert ON ai_conversations;
CREATE POLICY ai_conversations_owner_insert
  ON ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_conversations.company_id
    )
    AND ai_conversations.user_id = auth.uid()
  );

DROP POLICY IF EXISTS ai_conversations_owner_update ON ai_conversations;
CREATE POLICY ai_conversations_owner_update
  ON ai_conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_conversations.company_id
    )
    AND ai_conversations.user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_conversations.company_id
    )
    AND ai_conversations.user_id = auth.uid()
  );

-- Messages: same company + conversation owned by current user
DROP POLICY IF EXISTS ai_chat_messages_owner_select ON ai_chat_messages;
CREATE POLICY ai_chat_messages_owner_select
  ON ai_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM ai_conversations c
      WHERE c.id = ai_chat_messages.conversation_id
        AND c.user_id = auth.uid()
        AND c.company_id = ai_chat_messages.company_id
    )
  );

DROP POLICY IF EXISTS ai_chat_messages_owner_insert ON ai_chat_messages;
CREATE POLICY ai_chat_messages_owner_insert
  ON ai_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ai_conversations c
      WHERE c.id = ai_chat_messages.conversation_id
        AND c.user_id = auth.uid()
        AND c.company_id = ai_chat_messages.company_id
    )
    AND EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.company_id = ai_chat_messages.company_id
    )
  );

DROP POLICY IF EXISTS ai_conversations_service_role_all ON ai_conversations;
CREATE POLICY ai_conversations_service_role_all
  ON ai_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ai_chat_messages_service_role_all ON ai_chat_messages;
CREATE POLICY ai_chat_messages_service_role_all
  ON ai_chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
