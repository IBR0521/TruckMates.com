-- Enterprise API Keys Schema
-- Allows companies to generate API keys for programmatic access

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- User-friendly name for the key
  key_hash TEXT NOT NULL UNIQUE, -- Hashed API key (SHA-256)
  key_prefix TEXT NOT NULL, -- First 8 chars of key for display (e.g., "tm_live_")
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = never expires
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60, -- Requests per minute
  rate_limit_per_day INTEGER DEFAULT 10000, -- Requests per day
  allowed_ips TEXT[], -- NULL = allow all IPs, or array of allowed IPs
  scopes JSONB DEFAULT '["read"]'::jsonb, -- ["read", "write", "admin"]
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT api_keys_name_company_unique UNIQUE (company_id, name)
);

-- API Key Usage Log
CREATE TABLE IF NOT EXISTS public.api_key_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL, -- e.g., "/api/v1/loads"
  method TEXT NOT NULL, -- GET, POST, PUT, DELETE
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER, -- Response time in milliseconds
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON public.api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_company_id ON public.api_key_usage(company_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON public.api_key_usage(created_at);

-- RLS Policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their company's API keys
CREATE POLICY "Users can view their company's API keys"
  ON public.api_keys FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Only managers can create/update/delete API keys
CREATE POLICY "Managers can manage their company's API keys"
  ON public.api_keys FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'operations_manager')
    )
  );

-- Users can view their company's API key usage
CREATE POLICY "Users can view their company's API key usage"
  ON public.api_key_usage FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- System can insert usage logs (via API routes)
CREATE POLICY "System can insert API key usage"
  ON public.api_key_usage FOR INSERT
  WITH CHECK (true); -- API routes bypass RLS with service role

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_api_keys_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION update_api_keys_updated_at_column();

-- Function to generate API key hash
-- Note: This is a placeholder - actual hashing should be done in application code
COMMENT ON TABLE public.api_keys IS 'Enterprise API keys for programmatic access. Keys are hashed before storage.';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters of key for display purposes (e.g., "tm_live_")';

