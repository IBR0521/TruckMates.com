-- ============================================================================
-- Real-time ETA Updates with PostGIS
-- Compares driver's current POINT with planned route LINESTRING
-- Provides hyper-accurate arrival times that update every 60 seconds
-- ============================================================================

-- Add PostGIS geometry columns to routes table
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS route_linestring GEOGRAPHY(LINESTRING, 4326),
  ADD COLUMN IF NOT EXISTS origin_coordinates JSONB,
  ADD COLUMN IF NOT EXISTS destination_coordinates JSONB,
  ADD COLUMN IF NOT EXISTS current_eta TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_eta_update TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS eta_confidence TEXT DEFAULT 'high'; -- 'high', 'medium', 'low'

-- Create index on route_linestring for spatial queries
CREATE INDEX IF NOT EXISTS idx_routes_route_linestring ON public.routes USING GIST(route_linestring);

-- Create ETA tracking table for historical ETA updates
CREATE TABLE IF NOT EXISTS public.eta_updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  
  -- Location data
  current_latitude DECIMAL(10, 8) NOT NULL,
  current_longitude DECIMAL(11, 8) NOT NULL,
  current_location GEOGRAPHY(POINT, 4326),
  current_speed INTEGER, -- MPH
  
  -- Route progress
  distance_traveled_meters DOUBLE PRECISION,
  distance_remaining_meters DOUBLE PRECISION,
  progress_percentage DECIMAL(5, 2), -- 0-100
  
  -- ETA calculation
  estimated_arrival TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_duration_minutes INTEGER,
  average_speed_mph DECIMAL(5, 2),
  
  -- Confidence metrics
  confidence TEXT DEFAULT 'high', -- 'high', 'medium', 'low'
  confidence_reason TEXT,
  
  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_eta_updates_route_id ON public.eta_updates(route_id);
CREATE INDEX IF NOT EXISTS idx_eta_updates_load_id ON public.eta_updates(load_id);
CREATE INDEX IF NOT EXISTS idx_eta_updates_truck_id ON public.eta_updates(truck_id);
CREATE INDEX IF NOT EXISTS idx_eta_updates_timestamp ON public.eta_updates(timestamp);
CREATE INDEX IF NOT EXISTS idx_eta_updates_current_location ON public.eta_updates USING GIST(current_location);

-- Function to create LINESTRING from waypoints
CREATE OR REPLACE FUNCTION create_route_linestring(
  p_route_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_route RECORD;
  v_waypoints JSONB;
  v_points GEOGRAPHY[];
BEGIN
  -- Get route with waypoints
  SELECT 
    r.*,
    r.waypoints,
    r.origin_coordinates,
    r.destination_coordinates
  INTO v_route
  FROM public.routes r
  WHERE r.id = p_route_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  
  -- Build waypoints array
  v_waypoints := '[]'::jsonb;
  
  -- Add origin if coordinates exist
  IF v_route.origin_coordinates IS NOT NULL THEN
    v_waypoints := v_waypoints || jsonb_build_array(v_route.origin_coordinates);
  END IF;
  
  -- Add intermediate waypoints
  IF v_route.waypoints IS NOT NULL AND jsonb_typeof(v_route.waypoints) = 'array' THEN
    v_waypoints := v_waypoints || v_route.waypoints;
  END IF;
  
  -- Add destination if coordinates exist
  IF v_route.destination_coordinates IS NOT NULL THEN
    v_waypoints := v_waypoints || jsonb_build_array(v_route.destination_coordinates);
  END IF;
  
  -- Need at least 2 points for a line
  IF jsonb_array_length(v_waypoints) < 2 THEN
    RETURN false;
  END IF;
  
  -- Build LINESTRING from waypoints using array aggregation
  -- Collect all valid points into an array
  SELECT ARRAY_AGG(
    ST_SetSRID(ST_MakePoint(
      (point->>'lng')::DECIMAL,
      (point->>'lat')::DECIMAL
    ), 4326)::geography
  )
  INTO v_points
  FROM jsonb_array_elements(v_waypoints) AS point
  WHERE (point->>'lng')::DECIMAL IS NOT NULL
    AND (point->>'lat')::DECIMAL IS NOT NULL;
  
  -- Create LINESTRING from points array
  IF array_length(v_points, 1) >= 2 THEN
    UPDATE public.routes
    SET route_linestring = ST_MakeLine(v_points::geometry[])::geography
    WHERE id = p_route_id;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate real-time ETA
CREATE OR REPLACE FUNCTION calculate_realtime_eta(
  p_route_id UUID,
  p_current_lat DECIMAL,
  p_current_lng DECIMAL,
  p_current_speed INTEGER DEFAULT NULL
)
RETURNS TABLE (
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  distance_remaining_meters DOUBLE PRECISION,
  distance_traveled_meters DOUBLE PRECISION,
  progress_percentage DECIMAL(5, 2),
  estimated_duration_minutes INTEGER,
  average_speed_mph DECIMAL(5, 2),
  confidence TEXT,
  confidence_reason TEXT
) AS $$
DECLARE
  v_route RECORD;
  v_current_point GEOGRAPHY;
  v_closest_point GEOGRAPHY;
  v_destination_point GEOGRAPHY;
  v_distance_remaining DOUBLE PRECISION;
  v_distance_traveled DOUBLE PRECISION;
  v_total_distance DOUBLE PRECISION;
  v_progress DECIMAL(5, 2);
  v_avg_speed_mph DECIMAL(5, 2);
  v_estimated_minutes INTEGER;
  v_estimated_arrival TIMESTAMP WITH TIME ZONE;
  v_confidence TEXT;
  v_confidence_reason TEXT;
  v_recent_speeds DECIMAL[];
BEGIN
  -- Get route with LINESTRING
  SELECT 
    r.*,
    r.route_linestring,
    r.destination_coordinates,
    r.estimated_arrival
  INTO v_route
  FROM public.routes r
  WHERE r.id = p_route_id
    AND r.route_linestring IS NOT NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found or LINESTRING not created';
  END IF;
  
  -- Create current position point
  v_current_point := ST_SetSRID(ST_MakePoint(p_current_lng, p_current_lat), 4326)::geography;
  
  -- Find closest point on route to current position
  v_closest_point := ST_ClosestPoint(v_route.route_linestring::geometry, v_current_point::geometry)::geography;
  
  -- Calculate distance traveled (along route)
  v_distance_traveled := ST_Length(
    ST_LineSubstring(
      v_route.route_linestring::geometry,
      0,
      ST_LineLocatePoint(v_route.route_linestring::geometry, v_closest_point::geometry)
    )::geography
  );
  
  -- Calculate total route distance
  v_total_distance := ST_Length(v_route.route_linestring);
  
  -- Calculate remaining distance
  v_distance_remaining := v_total_distance - v_distance_traveled;
  
  -- Calculate progress percentage
  v_progress := CASE 
    WHEN v_total_distance > 0 THEN (v_distance_traveled / v_total_distance) * 100
    ELSE 0
  END;
  
  -- Get average speed from recent locations (last 10 minutes)
  SELECT ARRAY_AGG(speed ORDER BY timestamp DESC)
  INTO v_recent_speeds
  FROM public.eld_locations
  WHERE truck_id = v_route.truck_id
    AND timestamp >= NOW() - INTERVAL '10 minutes'
    AND speed IS NOT NULL
    AND speed > 0
  LIMIT 10;
  
  -- Calculate average speed
  IF p_current_speed IS NOT NULL AND p_current_speed > 0 THEN
    v_avg_speed_mph := p_current_speed::DECIMAL;
  ELSIF array_length(v_recent_speeds, 1) > 0 THEN
    SELECT AVG(speed) INTO v_avg_speed_mph
    FROM unnest(v_recent_speeds) AS speed;
  ELSE
    -- Default to 55 MPH if no speed data
    v_avg_speed_mph := 55.0;
  END IF;
  
  -- Calculate ETA (convert meters to miles, then to minutes)
  -- distance_remaining_meters / 1609.34 = miles
  -- miles / speed_mph * 60 = minutes
  v_estimated_minutes := CEIL((v_distance_remaining / 1609.34) / NULLIF(v_avg_speed_mph, 0) * 60);
  
  -- Calculate estimated arrival time
  v_estimated_arrival := NOW() + (v_estimated_minutes || ' minutes')::INTERVAL;
  
  -- Determine confidence level
  IF v_avg_speed_mph > 0 AND array_length(v_recent_speeds, 1) >= 5 THEN
    v_confidence := 'high';
    v_confidence_reason := 'Multiple recent speed readings available';
  ELSIF v_avg_speed_mph > 0 THEN
    v_confidence := 'medium';
    v_confidence_reason := 'Limited speed data, using current/average speed';
  ELSE
    v_confidence := 'low';
    v_confidence_reason := 'No speed data available, using default speed';
  END IF;
  
  -- If vehicle is stopped or very slow, adjust confidence
  IF v_avg_speed_mph < 5 AND v_distance_remaining > 1000 THEN
    v_confidence := 'low';
    v_confidence_reason := 'Vehicle appears stopped, ETA may be inaccurate';
  END IF;
  
  RETURN QUERY SELECT
    v_estimated_arrival,
    v_distance_remaining,
    v_distance_traveled,
    v_progress,
    v_estimated_minutes,
    v_avg_speed_mph,
    v_confidence,
    v_confidence_reason;
END;
$$ LANGUAGE plpgsql;

-- Function to update route ETA (called every 60 seconds)
CREATE OR REPLACE FUNCTION update_route_eta(
  p_route_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_route RECORD;
  v_truck RECORD;
  v_current_location RECORD;
  v_eta_result RECORD;
  v_eta_update_id UUID;
BEGIN
  -- Get route with truck info
  SELECT 
    r.*,
    t.id as truck_id,
    t.current_driver_id as driver_id
  INTO v_route
  FROM public.routes r
  LEFT JOIN public.trucks t ON t.id = r.truck_id
  WHERE r.id = p_route_id
    AND r.status IN ('in_progress', 'scheduled')
    AND r.route_linestring IS NOT NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found or not active';
  END IF;
  
  -- Get current location (latest ELD location)
  SELECT 
    latitude,
    longitude,
    speed,
    timestamp
  INTO v_current_location
  FROM public.eld_locations
  WHERE truck_id = v_route.truck_id
    AND timestamp >= NOW() - INTERVAL '5 minutes'
  ORDER BY timestamp DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No recent location data for truck';
  END IF;
  
  -- Calculate ETA
  SELECT * INTO v_eta_result
  FROM calculate_realtime_eta(
    p_route_id,
    v_current_location.latitude,
    v_current_location.longitude,
    v_current_location.speed
  );
  
  -- Update route with new ETA
  UPDATE public.routes
  SET 
    current_eta = v_eta_result.estimated_arrival,
    last_eta_update = NOW(),
    eta_confidence = v_eta_result.confidence
  WHERE id = p_route_id;
  
  -- Create ETA update record
  INSERT INTO public.eta_updates (
    company_id,
    route_id,
    load_id,
    truck_id,
    driver_id,
    current_latitude,
    current_longitude,
    current_location,
    current_speed,
    distance_traveled_meters,
    distance_remaining_meters,
    progress_percentage,
    estimated_arrival,
    estimated_duration_minutes,
    average_speed_mph,
    confidence,
    confidence_reason
  ) VALUES (
    v_route.company_id,
    p_route_id,
    (SELECT load_id FROM public.loads WHERE route_id = p_route_id LIMIT 1),
    v_route.truck_id,
    v_route.driver_id,
    v_current_location.latitude,
    v_current_location.longitude,
    ST_SetSRID(ST_MakePoint(v_current_location.longitude, v_current_location.latitude), 4326)::geography,
    v_current_location.speed,
    v_eta_result.distance_traveled_meters,
    v_eta_result.distance_remaining_meters,
    v_eta_result.progress_percentage,
    v_eta_result.estimated_arrival,
    v_eta_result.estimated_duration_minutes,
    v_eta_result.average_speed_mph,
    v_eta_result.confidence,
    v_eta_result.confidence_reason
  )
  RETURNING id INTO v_eta_update_id;
  
  RETURN v_eta_update_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create LINESTRING when route waypoints are updated
CREATE OR REPLACE FUNCTION trigger_create_route_linestring()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.waypoints IS DISTINCT FROM OLD.waypoints 
     OR NEW.origin_coordinates IS DISTINCT FROM OLD.origin_coordinates
     OR NEW.destination_coordinates IS DISTINCT FROM OLD.destination_coordinates THEN
    PERFORM create_route_linestring(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER route_linestring_trigger
  AFTER INSERT OR UPDATE OF waypoints, origin_coordinates, destination_coordinates
  ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_route_linestring();

-- Enable RLS
ALTER TABLE public.eta_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view ETA updates from their company"
  ON public.eta_updates
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ETA updates for their company"
  ON public.eta_updates
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON COLUMN public.routes.route_linestring IS 
  'PostGIS LINESTRING geometry representing the planned route path';
COMMENT ON COLUMN public.routes.current_eta IS 
  'Real-time estimated arrival time, updated every 60 seconds';
COMMENT ON FUNCTION calculate_realtime_eta IS 
  'Calculates hyper-accurate ETA by comparing driver current POINT with route LINESTRING';
COMMENT ON FUNCTION update_route_eta IS 
  'Updates route ETA using current driver location and speed, should be called every 60 seconds';

