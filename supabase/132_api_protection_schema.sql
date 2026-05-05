-- API Protection Schema
-- Rate limiting, caching, and usage tracking for platform-wide API keys

-- API Cache Table (for expensive API calls)
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

-- Auto-cleanup expired cache entries (runs daily)
-- You can set up a cron job to run: DELETE FROM api_cache WHERE expires_at < NOW();

-- API Usage Tracking (optional - for monitoring/billing)
CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  api_name TEXT NOT NULL,
  action TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_company ON api_usage_log(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_name ON api_usage_log(api_name, created_at);

-- RLS Policies
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

-- Cache is readable by all authenticated users (for shared caching)
CREATE POLICY "Users can read cache" ON api_cache
  FOR SELECT
  USING (true);

-- Only system can write to cache (via server actions)
CREATE POLICY "System can write cache" ON api_cache
  FOR ALL
  USING (false); -- Server actions bypass RLS

-- Usage logs are readable by company users
CREATE POLICY "Users can read their company usage" ON api_usage_log
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only system can write usage logs
CREATE POLICY "System can write usage logs" ON api_usage_log
  FOR ALL
  USING (false); -- Server actions bypass RLS

