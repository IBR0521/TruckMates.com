-- Webhook System Schema
-- This script creates tables for webhook management and delivery

-- Webhooks table (webhook configurations)
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of event types to subscribe to
  secret TEXT, -- HMAC secret for webhook signature
  active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, url)
);

-- Webhook deliveries table (delivery history and logs)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'delivered', 'failed', 'retrying'
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  next_retry_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhooks_company_id ON webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- RLS Policies
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Webhooks policies
DROP POLICY IF EXISTS "Users can view webhooks in their company" ON webhooks;
CREATE POLICY "Users can view webhooks in their company" ON webhooks
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert webhooks in their company" ON webhooks;
CREATE POLICY "Users can insert webhooks in their company" ON webhooks
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update webhooks in their company" ON webhooks;
CREATE POLICY "Users can update webhooks in their company" ON webhooks
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete webhooks in their company" ON webhooks;
CREATE POLICY "Users can delete webhooks in their company" ON webhooks
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Webhook deliveries policies
DROP POLICY IF EXISTS "Users can view webhook deliveries in their company" ON webhook_deliveries;
CREATE POLICY "Users can view webhook deliveries in their company" ON webhook_deliveries
  FOR SELECT USING (
    webhook_id IN (SELECT id FROM webhooks WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert webhook deliveries in their company" ON webhook_deliveries;
CREATE POLICY "Users can insert webhook deliveries in their company" ON webhook_deliveries
  FOR INSERT WITH CHECK (
    webhook_id IN (SELECT id FROM webhooks WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update webhook deliveries in their company" ON webhook_deliveries;
CREATE POLICY "Users can update webhook deliveries in their company" ON webhook_deliveries
  FOR UPDATE USING (
    webhook_id IN (SELECT id FROM webhooks WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

