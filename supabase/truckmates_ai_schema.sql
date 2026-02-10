-- ============================================================================
-- TruckMates AI System - Database Schema
-- ============================================================================
-- This schema supports:
-- 1. AI Knowledge Base (for RAG)
-- 2. Vector embeddings storage
-- 3. Conversation history
-- ============================================================================

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- AI Knowledge Base Table
-- ============================================================================
-- Stores logistics knowledge with vector embeddings for semantic search

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'regulation', 'best_practice', 'terminology', 'kpi', 'pricing', 'cost'
  title TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  embedding vector(384), -- nomic-embed-text dimension (384)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS ai_knowledge_base_embedding_idx 
ON ai_knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for content type and company
CREATE INDEX IF NOT EXISTS ai_knowledge_base_type_idx 
ON ai_knowledge_base (content_type, company_id);

-- Index for tags
CREATE INDEX IF NOT EXISTS ai_knowledge_base_tags_idx 
ON ai_knowledge_base USING GIN (tags);

-- ============================================================================
-- Function for Semantic Search
-- ============================================================================

CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  content_type text,
  title text,
  category text,
  tags text[],
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_knowledge_base.id,
    ai_knowledge_base.content,
    ai_knowledge_base.content_type,
    ai_knowledge_base.title,
    ai_knowledge_base.category,
    ai_knowledge_base.tags,
    ai_knowledge_base.metadata,
    1 - (ai_knowledge_base.embedding <=> query_embedding) as similarity
  FROM ai_knowledge_base
  WHERE 
    (company_id IS NULL OR ai_knowledge_base.company_id = company_id)
    AND ai_knowledge_base.embedding IS NOT NULL
    AND 1 - (ai_knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- AI Conversation History
-- ============================================================================
-- Stores conversation history for context

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID DEFAULT gen_random_uuid(), -- Groups related messages
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  function_calls JSONB,
  function_results JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for conversation threads
CREATE INDEX IF NOT EXISTS ai_conversations_thread_idx 
ON ai_conversations (thread_id, created_at);

-- Index for user conversations
CREATE INDEX IF NOT EXISTS ai_conversations_user_idx 
ON ai_conversations (user_id, company_id, created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Knowledge Base: Users can view knowledge for their company
CREATE POLICY "Users can view knowledge for their company"
ON ai_knowledge_base
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
  OR company_id IS NULL -- Public knowledge
);

-- Knowledge Base: Users can insert knowledge for their company
CREATE POLICY "Users can insert knowledge for their company"
ON ai_knowledge_base
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- Conversations: Users can view their own conversations
CREATE POLICY "Users can view their conversations"
ON ai_conversations
FOR SELECT
USING (
  user_id = auth.uid()
  AND company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- Conversations: Users can insert their own messages
CREATE POLICY "Users can insert their conversations"
ON ai_conversations
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  )
);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get conversation history
CREATE OR REPLACE FUNCTION get_conversation_history(
  p_thread_id uuid,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  role text,
  message text,
  function_calls jsonb,
  function_results jsonb,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_conversations.id,
    ai_conversations.role,
    ai_conversations.message,
    ai_conversations.function_calls,
    ai_conversations.function_results,
    ai_conversations.created_at
  FROM ai_conversations
  WHERE 
    ai_conversations.thread_id = p_thread_id
    AND ai_conversations.user_id = auth.uid()
  ORDER BY ai_conversations.created_at ASC
  LIMIT p_limit;
END;
$$;


