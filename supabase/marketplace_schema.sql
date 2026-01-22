-- Load Marketplace Schema
-- This enables brokers to post loads and carriers to automatically receive them in TruckMates

-- Load Marketplace Table (stores loads posted by brokers)
CREATE TABLE IF NOT EXISTS public.load_marketplace (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  broker_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Load Details
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  weight TEXT,
  weight_kg INTEGER,
  contents TEXT,
  value DECIMAL(10, 2),
  rate DECIMAL(10, 2) NOT NULL,
  rate_type TEXT DEFAULT 'flat', -- 'flat', 'per_mile', 'per_ton'
  
  -- Dates
  pickup_date DATE,
  pickup_time_window_start TIME,
  pickup_time_window_end TIME,
  delivery_date DATE,
  delivery_time_window_start TIME,
  delivery_time_window_end TIME,
  
  -- Shipper Information
  shipper_name TEXT,
  shipper_address TEXT,
  shipper_city TEXT,
  shipper_state TEXT,
  shipper_zip TEXT,
  shipper_contact_name TEXT,
  shipper_contact_phone TEXT,
  shipper_contact_email TEXT,
  pickup_instructions TEXT,
  
  -- Consignee Information
  consignee_name TEXT,
  consignee_address TEXT,
  consignee_city TEXT,
  consignee_state TEXT,
  consignee_zip TEXT,
  consignee_contact_name TEXT,
  consignee_contact_phone TEXT,
  consignee_contact_email TEXT,
  delivery_instructions TEXT,
  
  -- Freight Details
  pieces INTEGER,
  pallets INTEGER,
  boxes INTEGER,
  length DECIMAL(10, 2),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  temperature INTEGER,
  is_hazardous BOOLEAN DEFAULT FALSE,
  is_oversized BOOLEAN DEFAULT FALSE,
  special_instructions TEXT,
  
  -- Requirements
  requires_liftgate BOOLEAN DEFAULT FALSE,
  requires_inside_delivery BOOLEAN DEFAULT FALSE,
  requires_appointment BOOLEAN DEFAULT FALSE,
  appointment_time TIMESTAMP WITH TIME ZONE,
  
  -- Equipment Type
  equipment_type TEXT, -- 'dry_van', 'reefer', 'flatbed', 'step_deck', etc.
  
  -- Status
  status TEXT DEFAULT 'available', -- 'available', 'matched', 'accepted', 'completed', 'cancelled'
  
  -- Auto-creation settings
  auto_create_enabled BOOLEAN DEFAULT TRUE, -- If true, auto-creates loads for matching carriers
  
  -- Matching
  matched_carrier_id UUID REFERENCES public.companies(id) ON DELETE SET NULL, -- Carrier who accepted
  matched_at TIMESTAMP WITH TIME ZONE,
  
  -- Created load reference (after acceptance)
  created_load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Marketplace Subscriptions (carriers subscribe to auto-receive matching loads)
CREATE TABLE IF NOT EXISTS public.marketplace_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrier_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Filter Preferences
  origin_filter TEXT[], -- Preferred origins (e.g., ['CA', 'TX', 'NY'])
  destination_filter TEXT[], -- Preferred destinations
  min_rate DECIMAL(10, 2), -- Minimum rate filter
  max_rate DECIMAL(10, 2), -- Maximum rate filter
  equipment_types TEXT[], -- Preferred equipment types
  
  -- Auto-accept settings
  auto_accept BOOLEAN DEFAULT FALSE, -- If true, automatically accept matching loads
  auto_accept_min_rate DECIMAL(10, 2), -- Minimum rate for auto-accept
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(carrier_company_id) -- One subscription per carrier
);

-- Marketplace Load Views (tracks which carriers viewed which loads)
CREATE TABLE IF NOT EXISTS public.marketplace_load_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  marketplace_load_id UUID REFERENCES public.load_marketplace(id) ON DELETE CASCADE NOT NULL,
  carrier_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(marketplace_load_id, carrier_company_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_load_marketplace_broker_id ON public.load_marketplace(broker_id);
CREATE INDEX IF NOT EXISTS idx_load_marketplace_status ON public.load_marketplace(status);
CREATE INDEX IF NOT EXISTS idx_load_marketplace_origin ON public.load_marketplace(origin);
CREATE INDEX IF NOT EXISTS idx_load_marketplace_destination ON public.load_marketplace(destination);
CREATE INDEX IF NOT EXISTS idx_load_marketplace_created_at ON public.load_marketplace(created_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_carrier_id ON public.marketplace_subscriptions(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_load_views_load_id ON public.marketplace_load_views(marketplace_load_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_load_views_carrier_id ON public.marketplace_load_views(carrier_company_id);

-- RLS Policies for load_marketplace
ALTER TABLE public.load_marketplace ENABLE ROW LEVEL SECURITY;

-- Anyone can view available loads (public marketplace)
CREATE POLICY "Public can view available marketplace loads"
  ON public.load_marketplace FOR SELECT
  USING (status = 'available');

-- Brokers can manage their own loads
CREATE POLICY "Brokers can manage their own marketplace loads"
  ON public.load_marketplace FOR ALL
  USING (
    broker_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  )
  WITH CHECK (
    broker_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Carriers can view and accept loads
CREATE POLICY "Carriers can view and accept marketplace loads"
  ON public.load_marketplace FOR SELECT
  USING (
    status = 'available' OR
    matched_carrier_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Carriers can accept marketplace loads"
  ON public.load_marketplace FOR UPDATE
  USING (
    status = 'available' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    status IN ('matched', 'accepted')
  );

-- RLS Policies for marketplace_subscriptions
ALTER TABLE public.marketplace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carriers can manage their own subscriptions"
  ON public.marketplace_subscriptions FOR ALL
  USING (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  )
  WITH CHECK (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for marketplace_load_views
ALTER TABLE public.marketplace_load_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carriers can view their own load views"
  ON public.marketplace_load_views FOR ALL
  USING (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_load_marketplace_updated_at BEFORE UPDATE ON public.load_marketplace
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_subscriptions_updated_at BEFORE UPDATE ON public.marketplace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add source field to loads table to track marketplace loads
ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual', -- 'manual', 'marketplace'
ADD COLUMN IF NOT EXISTS marketplace_load_id UUID REFERENCES public.load_marketplace(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loads_source ON public.loads(source);
CREATE INDEX IF NOT EXISTS idx_loads_marketplace_load_id ON public.loads(marketplace_load_id);

