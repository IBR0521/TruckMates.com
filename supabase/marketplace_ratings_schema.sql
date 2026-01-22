-- Marketplace Ratings & Reviews Schema
-- This enables brokers and carriers to rate each other after load completion

-- Broker Ratings (carriers rate brokers)
CREATE TABLE IF NOT EXISTS public.broker_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  broker_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  carrier_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  marketplace_load_id UUID REFERENCES public.load_marketplace(id) ON DELETE SET NULL,
  
  -- Rating (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Rating Categories
  payment_speed_rating INTEGER CHECK (payment_speed_rating >= 1 AND payment_speed_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  load_quality_rating INTEGER CHECK (load_quality_rating >= 1 AND load_quality_rating <= 5),
  
  -- Review
  review_text TEXT,
  
  -- Payment Details (for context)
  payment_days INTEGER, -- Days to payment
  payment_received BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- One rating per load per carrier
  UNIQUE(carrier_company_id, load_id),
  UNIQUE(carrier_company_id, marketplace_load_id)
);

-- Carrier Ratings (brokers rate carriers)
CREATE TABLE IF NOT EXISTS public.carrier_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrier_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  broker_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  marketplace_load_id UUID REFERENCES public.load_marketplace(id) ON DELETE SET NULL,
  
  -- Rating (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Rating Categories
  on_time_rating INTEGER CHECK (on_time_rating >= 1 AND on_time_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  
  -- Review
  review_text TEXT,
  
  -- Performance Details
  on_time_delivery BOOLEAN DEFAULT TRUE,
  damage_reported BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- One rating per load per broker
  UNIQUE(broker_company_id, load_id),
  UNIQUE(broker_company_id, marketplace_load_id)
);

-- Broker Statistics (aggregated from ratings)
CREATE TABLE IF NOT EXISTS public.broker_statistics (
  broker_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Aggregated Ratings
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  average_payment_speed_rating DECIMAL(3, 2) DEFAULT 0,
  average_communication_rating DECIMAL(3, 2) DEFAULT 0,
  average_load_quality_rating DECIMAL(3, 2) DEFAULT 0,
  
  -- Payment Metrics
  average_payment_days DECIMAL(5, 2) DEFAULT 0,
  payment_rate DECIMAL(5, 2) DEFAULT 100, -- Percentage of loads paid
  
  -- Load Metrics
  total_loads_posted INTEGER DEFAULT 0,
  total_loads_completed INTEGER DEFAULT 0,
  
  -- Trust Indicators
  verified BOOLEAN DEFAULT FALSE,
  authority_age_years INTEGER,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Carrier Statistics (aggregated from ratings)
CREATE TABLE IF NOT EXISTS public.carrier_statistics (
  carrier_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Aggregated Ratings
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  average_on_time_rating DECIMAL(3, 2) DEFAULT 0,
  average_communication_rating DECIMAL(3, 2) DEFAULT 0,
  average_professionalism_rating DECIMAL(3, 2) DEFAULT 0,
  
  -- Performance Metrics
  on_time_delivery_rate DECIMAL(5, 2) DEFAULT 0, -- Percentage
  damage_rate DECIMAL(5, 2) DEFAULT 0, -- Percentage
  
  -- Load Metrics
  total_loads_accepted INTEGER DEFAULT 0,
  total_loads_completed INTEGER DEFAULT 0,
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  mc_number TEXT,
  dot_number TEXT,
  authority_age_years INTEGER,
  insurance_status TEXT,
  insurance_expiry DATE,
  safety_rating TEXT,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_broker_ratings_broker_id ON public.broker_ratings(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_ratings_carrier_id ON public.broker_ratings(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_ratings_load_id ON public.broker_ratings(load_id);
CREATE INDEX IF NOT EXISTS idx_carrier_ratings_carrier_id ON public.carrier_ratings(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_carrier_ratings_broker_id ON public.carrier_ratings(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_carrier_ratings_load_id ON public.carrier_ratings(load_id);

-- RLS Policies for broker_ratings
ALTER TABLE public.broker_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view broker ratings"
  ON public.broker_ratings FOR SELECT
  USING (true);

CREATE POLICY "Carriers can create ratings for brokers"
  ON public.broker_ratings FOR INSERT
  WITH CHECK (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Carriers can update their own ratings"
  ON public.broker_ratings FOR UPDATE
  USING (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for carrier_ratings
ALTER TABLE public.carrier_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view carrier ratings"
  ON public.carrier_ratings FOR SELECT
  USING (true);

CREATE POLICY "Brokers can create ratings for carriers"
  ON public.carrier_ratings FOR INSERT
  WITH CHECK (
    broker_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Brokers can update their own ratings"
  ON public.carrier_ratings FOR UPDATE
  USING (
    broker_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for broker_statistics
ALTER TABLE public.broker_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view broker statistics"
  ON public.broker_statistics FOR SELECT
  USING (true);

CREATE POLICY "Brokers can update their own statistics"
  ON public.broker_statistics FOR ALL
  USING (
    broker_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for carrier_statistics
ALTER TABLE public.carrier_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view carrier statistics"
  ON public.carrier_statistics FOR SELECT
  USING (true);

CREATE POLICY "Carriers can update their own statistics"
  ON public.carrier_statistics FOR ALL
  USING (
    carrier_company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger to update updated_at column
CREATE TRIGGER update_broker_ratings_updated_at BEFORE UPDATE ON public.broker_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carrier_ratings_updated_at BEFORE UPDATE ON public.carrier_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broker_statistics_updated_at BEFORE UPDATE ON public.broker_statistics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carrier_statistics_updated_at BEFORE UPDATE ON public.carrier_statistics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update broker statistics when a rating is added/updated
CREATE OR REPLACE FUNCTION update_broker_statistics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.broker_statistics (broker_company_id)
  VALUES (NEW.broker_company_id)
  ON CONFLICT (broker_company_id) DO NOTHING;

  UPDATE public.broker_statistics
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id
    ),
    total_ratings = (
      SELECT COUNT(*) FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id
    ),
    average_payment_speed_rating = (
      SELECT COALESCE(AVG(payment_speed_rating), 0) FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id AND payment_speed_rating IS NOT NULL
    ),
    average_communication_rating = (
      SELECT COALESCE(AVG(communication_rating), 0) FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id AND communication_rating IS NOT NULL
    ),
    average_load_quality_rating = (
      SELECT COALESCE(AVG(load_quality_rating), 0) FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id AND load_quality_rating IS NOT NULL
    ),
    average_payment_days = (
      SELECT COALESCE(AVG(payment_days), 0) FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id AND payment_days IS NOT NULL
    ),
    payment_rate = (
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE payment_received = true)::DECIMAL / COUNT(*)::DECIMAL * 100)
          ELSE 100
        END
      FROM public.broker_ratings
      WHERE broker_company_id = NEW.broker_company_id
    ),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE broker_company_id = NEW.broker_company_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update carrier statistics when a rating is added/updated
CREATE OR REPLACE FUNCTION update_carrier_statistics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.carrier_statistics (carrier_company_id)
  VALUES (NEW.carrier_company_id)
  ON CONFLICT (carrier_company_id) DO NOTHING;

  UPDATE public.carrier_statistics
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id
    ),
    total_ratings = (
      SELECT COUNT(*) FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id
    ),
    average_on_time_rating = (
      SELECT COALESCE(AVG(on_time_rating), 0) FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id AND on_time_rating IS NOT NULL
    ),
    average_communication_rating = (
      SELECT COALESCE(AVG(communication_rating), 0) FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id AND communication_rating IS NOT NULL
    ),
    average_professionalism_rating = (
      SELECT COALESCE(AVG(professionalism_rating), 0) FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id AND professionalism_rating IS NOT NULL
    ),
    on_time_delivery_rate = (
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE on_time_delivery = true)::DECIMAL / COUNT(*)::DECIMAL * 100)
          ELSE 100
        END
      FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id
    ),
    damage_rate = (
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE damage_reported = true)::DECIMAL / COUNT(*)::DECIMAL * 100)
          ELSE 0
        END
      FROM public.carrier_ratings
      WHERE carrier_company_id = NEW.carrier_company_id
    ),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE carrier_company_id = NEW.carrier_company_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update statistics
CREATE TRIGGER update_broker_stats_on_rating
  AFTER INSERT OR UPDATE ON public.broker_ratings
  FOR EACH ROW EXECUTE FUNCTION update_broker_statistics();

CREATE TRIGGER update_carrier_stats_on_rating
  AFTER INSERT OR UPDATE ON public.carrier_ratings
  FOR EACH ROW EXECUTE FUNCTION update_carrier_statistics();

