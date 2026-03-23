-- ============================================================================
-- Enhanced AI-Powered Predictive ETA with Real-Time Traffic
-- Uses Google Maps API for traffic-aware routing and HOS integration
-- ============================================================================

-- Add traffic-aware route columns
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS traffic_aware_route_linestring GEOGRAPHY(LINESTRING, 4326),
  ADD COLUMN IF NOT EXISTS traffic_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS traffic_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS traffic_last_updated TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS traffic_polyline TEXT, -- Encoded polyline from Google Maps
  ADD COLUMN IF NOT EXISTS hos_adjusted_eta TIMESTAMP WITH TIME ZONE, -- ETA adjusted for HOS breaks
  ADD COLUMN IF NOT EXISTS traffic_confidence TEXT DEFAULT 'high'; -- 'high', 'medium', 'low'

-- Create index on traffic route
CREATE INDEX IF NOT EXISTS idx_routes_traffic_linestring ON public.routes USING GIST(traffic_aware_route_linestring);

-- Function to update traffic-aware route from Google Maps API
-- This should be called by application code that fetches from Google Maps
CREATE OR REPLACE FUNCTION update_traffic_aware_route(
  p_route_id UUID,
  p_traffic_polyline TEXT,
  p_traffic_duration_minutes INTEGER,
  p_traffic_distance_meters DOUBLE PRECISION,
  p_waypoints JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_points GEOGRAPHY[];
  v_decoded_points JSONB;
BEGIN
  -- Decode polyline to points (this is simplified - actual decoding should be done in application)
  -- For now, we'll store the polyline and decode it in application code
  -- The application should call this with a decoded points array
  
  -- Update route with traffic data
  UPDATE public.routes
  SET 
    traffic_polyline = p_traffic_polyline,
    traffic_duration_minutes = p_traffic_duration_minutes,
    traffic_distance_meters = p_traffic_distance_meters,
    traffic_last_updated = NOW(),
    traffic_confidence = 'high'
  WHERE id = p_route_id;
  
  -- If waypoints are provided, build LINESTRING
  IF p_waypoints IS NOT NULL AND jsonb_array_length(p_waypoints) >= 2 THEN
    SELECT ARRAY_AGG(
      ST_SetSRID(ST_MakePoint(
        (point->>'lng')::DECIMAL,
        (point->>'lat')::DECIMAL
      ), 4326)::geography
    )
    INTO v_points
    FROM jsonb_array_elements(p_waypoints) AS point
    WHERE (point->>'lng')::DECIMAL IS NOT NULL
      AND (point->>'lat')::DECIMAL IS NOT NULL;
    
    IF array_length(v_points, 1) >= 2 THEN
      UPDATE public.routes
      SET traffic_aware_route_linestring = ST_MakeLine(v_points::geometry[])::geography
      WHERE id = p_route_id;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Enhanced ETA calculation with HOS integration
CREATE OR REPLACE FUNCTION calculate_enhanced_eta_with_hos(
  p_route_id UUID,
  p_current_lat DECIMAL,
  p_current_lng DECIMAL,
  p_current_speed INTEGER DEFAULT NULL,
  p_driver_id UUID DEFAULT NULL
)
RETURNS TABLE (
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  hos_adjusted_arrival TIMESTAMP WITH TIME ZONE,
  distance_remaining_meters DOUBLE PRECISION,
  distance_traveled_meters DOUBLE PRECISION,
  progress_percentage DECIMAL(5, 2),
  estimated_duration_minutes INTEGER,
  hos_break_minutes INTEGER,
  total_duration_with_breaks INTEGER,
  average_speed_mph DECIMAL(5, 2),
  confidence TEXT,
  confidence_reason TEXT,
  uses_traffic_data BOOLEAN
) AS $$
DECLARE
  v_route RECORD;
  v_current_point GEOGRAPHY;
  v_closest_point GEOGRAPHY;
  v_distance_remaining DOUBLE PRECISION;
  v_distance_traveled DOUBLE PRECISION;
  v_total_distance DOUBLE PRECISION;
  v_progress DECIMAL(5, 2);
  v_avg_speed_mph DECIMAL(5, 2);
  v_estimated_minutes INTEGER;
  v_estimated_arrival TIMESTAMP WITH TIME ZONE;
  v_hos_break_minutes INTEGER := 0;
  v_total_minutes INTEGER;
  v_hos_adjusted_arrival TIMESTAMP WITH TIME ZONE;
  v_confidence TEXT;
  v_confidence_reason TEXT;
  v_uses_traffic BOOLEAN := false;
  v_recent_speeds DECIMAL[];
  v_driver_hos RECORD;
BEGIN
  -- Get route with traffic data
  SELECT 
    r.*,
    r.route_linestring,
    r.traffic_aware_route_linestring,
    r.traffic_duration_minutes,
    r.traffic_distance_meters,
    r.traffic_last_updated,
    r.destination_coordinates
  INTO v_route
  FROM public.routes r
  WHERE r.id = p_route_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  
  -- Prefer traffic-aware route if available and recent (< 10 minutes old)
  IF v_route.traffic_aware_route_linestring IS NOT NULL 
     AND v_route.traffic_last_updated IS NOT NULL
     AND v_route.traffic_last_updated > NOW() - INTERVAL '10 minutes' THEN
    v_uses_traffic := true;
    v_total_distance := v_route.traffic_distance_meters;
    v_estimated_minutes := v_route.traffic_duration_minutes;
  ELSIF v_route.route_linestring IS NOT NULL THEN
    -- Fallback to planned route
    v_total_distance := ST_Length(v_route.route_linestring);
    
    -- Create current position point
    v_current_point := ST_SetSRID(ST_MakePoint(p_current_lng, p_current_lat), 4326)::geography;
    
    -- Find closest point on route
    v_closest_point := ST_ClosestPoint(v_route.route_linestring::geometry, v_current_point::geometry)::geography;
    
    -- Calculate distance traveled
    v_distance_traveled := ST_Length(
      ST_LineSubstring(
        v_route.route_linestring::geometry,
        0,
        ST_LineLocatePoint(v_route.route_linestring::geometry, v_closest_point::geometry)
      )::geography
    );
    
    v_distance_remaining := v_total_distance - v_distance_traveled;
    
    -- Get average speed
    SELECT ARRAY_AGG(speed ORDER BY timestamp DESC)
    INTO v_recent_speeds
    FROM public.eld_locations
    WHERE truck_id = v_route.truck_id
      AND timestamp >= NOW() - INTERVAL '10 minutes'
      AND speed IS NOT NULL
      AND speed > 0
    LIMIT 10;
    
    IF p_current_speed IS NOT NULL AND p_current_speed > 0 THEN
      v_avg_speed_mph := p_current_speed::DECIMAL;
    ELSIF array_length(v_recent_speeds, 1) > 0 THEN
      SELECT AVG(speed) INTO v_avg_speed_mph
      FROM unnest(v_recent_speeds) AS speed;
    ELSE
      v_avg_speed_mph := 55.0; -- Default
    END IF;
    
    -- Calculate estimated minutes (convert meters to miles, then to minutes)
    v_estimated_minutes := ROUND((v_distance_remaining / 1609.34) / v_avg_speed_mph * 60);
  ELSE
    RAISE EXCEPTION 'Route has no geometry data';
  END IF;
  
  -- Calculate progress
  v_progress := CASE 
    WHEN v_total_distance > 0 THEN (v_distance_traveled / v_total_distance) * 100
    ELSE 0
  END;
  
  -- Get HOS data if driver provided
  IF p_driver_id IS NOT NULL THEN
    -- Get remaining HOS hours
    SELECT 
      remaining_driving_hours,
      remaining_on_duty_hours,
      needs_break,
      violations
    INTO v_driver_hos
    FROM (
      SELECT 
        GREATEST(0, 11 - COALESCE(SUM(CASE WHEN log_type = 'driving' THEN duration_minutes ELSE 0 END), 0) / 60.0) as remaining_driving_hours,
        GREATEST(0, 14 - COALESCE(SUM(CASE WHEN log_type IN ('driving', 'on_duty') THEN duration_minutes ELSE 0 END), 0) / 60.0) as remaining_on_duty_hours,
        CASE 
          WHEN COALESCE(SUM(CASE WHEN log_type = 'driving' THEN duration_minutes ELSE 0 END), 0) / 60.0 >= 8 
            AND COALESCE(SUM(CASE WHEN log_type IN ('off_duty', 'sleeper_berth') THEN duration_minutes ELSE 0 END), 0) / 60.0 < 0.5
          THEN true
          ELSE false
        END as needs_break,
        ARRAY[]::TEXT[] as violations
      FROM public.eld_logs
      WHERE driver_id = p_driver_id
        AND log_date = CURRENT_DATE
    ) hos_calc;
    
    -- Calculate if break is needed during remaining trip
    IF v_driver_hos.needs_break THEN
      -- Driver needs 30-minute break
      v_hos_break_minutes := 30;
    ELSIF v_estimated_minutes / 60.0 > v_driver_hos.remaining_driving_hours THEN
      -- Trip will exceed remaining drive hours - need break
      v_hos_break_minutes := 30;
    END IF;
  END IF;
  
  -- Calculate total duration with breaks
  v_total_minutes := v_estimated_minutes + v_hos_break_minutes;
  
  -- Calculate arrival times
  v_estimated_arrival := NOW() + (v_estimated_minutes || ' minutes')::INTERVAL;
  v_hos_adjusted_arrival := NOW() + (v_total_minutes || ' minutes')::INTERVAL;
  
  -- Determine confidence
  IF v_uses_traffic THEN
    v_confidence := 'high';
    v_confidence_reason := 'Using real-time traffic data';
  ELSIF v_route.traffic_last_updated IS NOT NULL AND v_route.traffic_last_updated < NOW() - INTERVAL '10 minutes' THEN
    v_confidence := 'medium';
    v_confidence_reason := 'Traffic data outdated, using planned route';
  ELSE
    v_confidence := 'medium';
    v_confidence_reason := 'Using planned route with GPS speed data';
  END IF;
  
  RETURN QUERY SELECT
    v_estimated_arrival,
    v_hos_adjusted_arrival,
    v_distance_remaining,
    v_distance_traveled,
    v_progress,
    v_estimated_minutes,
    v_hos_break_minutes,
    v_total_minutes,
    v_avg_speed_mph,
    v_confidence,
    v_confidence_reason,
    v_uses_traffic;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN public.routes.traffic_aware_route_linestring IS 
  'Traffic-aware route geometry from Google Maps API';
COMMENT ON COLUMN public.routes.traffic_duration_minutes IS 
  'Estimated duration in minutes with current traffic conditions';
COMMENT ON COLUMN public.routes.hos_adjusted_eta IS 
  'ETA adjusted for required HOS breaks';
COMMENT ON FUNCTION calculate_enhanced_eta_with_hos IS 
  'Calculates ETA with real-time traffic data and HOS break adjustments';

