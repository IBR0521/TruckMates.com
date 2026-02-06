-- External Broker/Load Board Integrations Schema
-- Supports DAT, Truckstop, 123Loadboard, and other load board APIs

-- External Broker Integrations table
CREATE TABLE IF NOT EXISTS public.external_broker_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Integration Type
  provider TEXT NOT NULL CHECK (provider IN ('dat', 'truckstop', '123loadboard', 'uber_freight', 'convoy', 'other')),
  
  -- DAT Integration
  dat_enabled BOOLEAN DEFAULT false,
  dat_api_key TEXT,
  dat_api_secret TEXT,
  dat_username TEXT,
  dat_password TEXT, -- Encrypted
  dat_subscription_tier TEXT, -- 'standard', 'enhanced', 'pro', 'select', 'office'
  dat_sync_enabled BOOLEAN DEFAULT false,
  dat_last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Truckstop Integration
  truckstop_enabled BOOLEAN DEFAULT false,
  truckstop_api_key TEXT,
  truckstop_api_secret TEXT,
  truckstop_username TEXT,
  truckstop_password TEXT, -- Encrypted
  truckstop_subscription_tier TEXT, -- 'basic', 'advanced', 'pro', 'premium'
  truckstop_sync_enabled BOOLEAN DEFAULT false,
  truckstop_last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- 123Loadboard Integration
  loadboard123_enabled BOOLEAN DEFAULT false,
  loadboard123_api_key TEXT,
  loadboard123_username TEXT,
  loadboard123_password TEXT, -- Encrypted
  loadboard123_sync_enabled BOOLEAN DEFAULT false,
  loadboard123_last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Generic/Other Provider
  other_provider_name TEXT,
  other_api_key TEXT,
  other_api_secret TEXT,
  other_api_url TEXT,
  other_sync_enabled BOOLEAN DEFAULT false,
  other_last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Sync Settings
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_interval_minutes INTEGER DEFAULT 15, -- How often to sync (15, 30, 60 minutes)
  sync_filters JSONB DEFAULT '{}'::jsonb, -- Origin, destination, equipment type filters
  max_loads_per_sync INTEGER DEFAULT 100, -- Limit number of loads per sync
  
  -- Status
  last_sync_status TEXT, -- 'success', 'error', 'partial'
  last_sync_error TEXT,
  total_loads_synced INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(company_id, provider)
);

-- External Loads table (loads synced from external boards)
CREATE TABLE IF NOT EXISTS public.external_loads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  integration_id UUID REFERENCES public.external_broker_integrations(id) ON DELETE CASCADE NOT NULL,
  
  -- External Load Identifiers
  external_load_id TEXT NOT NULL, -- Load ID from external board
  external_board TEXT NOT NULL, -- 'dat', 'truckstop', '123loadboard', etc.
  external_url TEXT, -- Link to load on external board
  
  -- Load Information (from external board)
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  rate DECIMAL(10, 2),
  rate_type TEXT, -- 'per_mile', 'flat', 'percentage'
  equipment_type TEXT,
  weight_lbs DECIMAL(10, 2),
  weight_kg DECIMAL(10, 2),
  pickup_date DATE,
  delivery_date DATE,
  distance_miles DECIMAL(10, 2),
  
  -- Broker Information
  broker_name TEXT,
  broker_mc_number TEXT,
  broker_rating DECIMAL(3, 2), -- 0.00 to 5.00
  broker_days_to_pay INTEGER,
  broker_credit_score TEXT,
  
  -- Additional Details
  load_description TEXT,
  special_requirements TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  
  -- Status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'expired', 'imported', 'ignored')),
  imported_load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL, -- If imported to internal loads
  
  -- Metadata
  raw_data JSONB, -- Full response from external API
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(integration_id, external_load_id)
);

-- Sync History table
CREATE TABLE IF NOT EXISTS public.external_load_sync_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  integration_id UUID REFERENCES public.external_broker_integrations(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'automatic', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  
  loads_found INTEGER DEFAULT 0,
  loads_synced INTEGER DEFAULT 0,
  loads_updated INTEGER DEFAULT 0,
  loads_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  error_message TEXT,
  error_details JSONB,
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_external_broker_integrations_company_id ON public.external_broker_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_external_broker_integrations_provider ON public.external_broker_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_external_loads_company_id ON public.external_loads(company_id);
CREATE INDEX IF NOT EXISTS idx_external_loads_integration_id ON public.external_loads(integration_id);
CREATE INDEX IF NOT EXISTS idx_external_loads_status ON public.external_loads(status);
CREATE INDEX IF NOT EXISTS idx_external_loads_origin_destination ON public.external_loads(origin, destination);
CREATE INDEX IF NOT EXISTS idx_external_load_sync_history_integration_id ON public.external_load_sync_history(integration_id);
CREATE INDEX IF NOT EXISTS idx_external_load_sync_history_company_id ON public.external_load_sync_history(company_id);

-- RLS Policies
ALTER TABLE public.external_broker_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_load_sync_history ENABLE ROW LEVEL SECURITY;

-- External Broker Integrations Policies
CREATE POLICY "Users can view their company external broker integrations"
  ON public.external_broker_integrations
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage their company external broker integrations"
  ON public.external_broker_integrations
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- External Loads Policies
CREATE POLICY "Users can view their company external loads"
  ON public.external_loads
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage their company external loads"
  ON public.external_loads
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Sync History Policies
CREATE POLICY "Users can view their company sync history"
  ON public.external_load_sync_history
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

