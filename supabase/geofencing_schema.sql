-- ============================================================================
-- Geofencing Schema
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Geofences table (zones)
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT DEFAULT 'circle', -- 'circle', 'polygon', 'rectangle'
  
  -- Circle zone (center + radius)
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),
  radius_meters INTEGER, -- Radius in meters
  
  -- Polygon zone (array of coordinates)
  polygon_coordinates JSONB, -- Array of {lat, lng} points
  
  -- Rectangle zone (bounds)
  north_bound DECIMAL(10, 8),
  south_bound DECIMAL(10, 8),
  east_bound DECIMAL(11, 8),
  west_bound DECIMAL(11, 8),
  
  -- Zone settings
  is_active BOOLEAN DEFAULT true,
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  alert_on_dwell BOOLEAN DEFAULT false, -- Alert if vehicle stays too long
  dwell_time_minutes INTEGER, -- Minutes before dwell alert
  
  -- Assignment
  assigned_trucks UUID[], -- Array of truck IDs
  assigned_routes UUID[], -- Array of route IDs
  
  -- Address (for display)
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Zone visits table (tracks entry/exit events)
CREATE TABLE IF NOT EXISTS public.zone_visits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES public.trucks(id),
  driver_id UUID REFERENCES public.drivers(id),
  route_id UUID REFERENCES public.routes(id),
  
  -- Visit details
  event_type TEXT NOT NULL, -- 'entry', 'exit', 'dwell'
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Time tracking
  entry_timestamp TIMESTAMP WITH TIME ZONE,
  exit_timestamp TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER, -- Duration inside zone (for exit events)
  
  -- Metadata
  speed DECIMAL(5, 2), -- Speed at time of event
  heading DECIMAL(5, 2), -- Direction of travel
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_geofences_company_id ON public.geofences(company_id);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON public.geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_zone_visits_geofence_id ON public.zone_visits(geofence_id);
CREATE INDEX IF NOT EXISTS idx_zone_visits_truck_id ON public.zone_visits(truck_id);
CREATE INDEX IF NOT EXISTS idx_zone_visits_timestamp ON public.zone_visits(timestamp);
CREATE INDEX IF NOT EXISTS idx_zone_visits_company_id ON public.zone_visits(company_id);
CREATE INDEX IF NOT EXISTS idx_zone_visits_event_type ON public.zone_visits(event_type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for geofences
CREATE POLICY "Users can view geofences from their company"
  ON public.geofences
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert geofences for their company"
  ON public.geofences
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update geofences from their company"
  ON public.geofences
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete geofences from their company"
  ON public.geofences
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for zone_visits
CREATE POLICY "Users can view zone visits from their company"
  ON public.zone_visits
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert zone visits for their company"
  ON public.zone_visits
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.geofences IS 'Geofencing zones for location-based alerts and tracking';
COMMENT ON TABLE public.zone_visits IS 'Tracks vehicle entry/exit events for geofences';
COMMENT ON COLUMN public.geofences.zone_type IS 'Type of zone: circle, polygon, or rectangle';
COMMENT ON COLUMN public.geofences.polygon_coordinates IS 'JSONB array of {lat, lng} coordinates for polygon zones';

