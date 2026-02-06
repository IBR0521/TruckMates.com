-- ============================================================================
-- Planned vs. Actual Route Tracking
-- Track actual driven route from GPS locations and compare with planned route
-- ============================================================================

-- Add actual route tracking columns
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS actual_route_linestring GEOGRAPHY(LINESTRING, 4326),
  ADD COLUMN IF NOT EXISTS actual_route_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_deviation_meters DOUBLE PRECISION, -- Average deviation from planned route
  ADD COLUMN IF NOT EXISTS route_efficiency_score DECIMAL(5, 2), -- 0-100, higher = more efficient
  ADD COLUMN IF NOT EXISTS planned_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS actual_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_difference_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS planned_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS duration_difference_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS actual_route_last_updated TIMESTAMP WITH TIME ZONE;

-- Create index on actual route
CREATE INDEX IF NOT EXISTS idx_routes_actual_linestring ON public.routes USING GIST(actual_route_linestring);

-- Function to build actual route LINESTRING from GPS locations
CREATE OR REPLACE FUNCTION build_actual_route(
  p_route_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_route RECORD;
  v_points GEOGRAPHY[];
  v_actual_distance DOUBLE PRECISION;
  v_planned_distance DOUBLE PRECISION;
  v_distance_diff DOUBLE PRECISION;
  v_route_start TIMESTAMP WITH TIME ZONE;
  v_route_end TIMESTAMP WITH TIME ZONE;
  v_actual_duration INTEGER;
  v_planned_duration INTEGER;
  v_duration_diff INTEGER;
  v_efficiency_score DECIMAL(5, 2);
  v_deviation_meters DOUBLE PRECISION;
BEGIN
  -- Get route details
  SELECT 
    r.*,
    r.route_start_time,
    r.route_complete_time,
    r.truck_id,
    r.route_linestring,
    r.traffic_distance_meters,
    r.traffic_duration_minutes
  INTO v_route
  FROM public.routes r
  WHERE r.id = p_route_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  
  IF v_route.truck_id IS NULL THEN
    RAISE EXCEPTION 'Route has no truck assigned';
  END IF;
  
  -- Determine time range
  v_route_start := COALESCE(p_start_time, v_route.route_start_time, NOW() - INTERVAL '7 days');
  v_route_end := COALESCE(p_end_time, v_route.route_complete_time, NOW());
  
  -- Get GPS locations for this truck during route execution
  -- Order by timestamp and build LINESTRING
  SELECT ARRAY_AGG(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ORDER BY timestamp
  )
  INTO v_points
  FROM public.eld_locations
  WHERE truck_id = v_route.truck_id
    AND timestamp >= v_route_start
    AND timestamp <= v_route_end
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;
  
  IF array_length(v_points, 1) IS NULL OR array_length(v_points, 1) < 2 THEN
    -- Not enough points to build a route
    RETURN false;
  END IF;
  
  -- Build actual route LINESTRING
  UPDATE public.routes
  SET 
    actual_route_linestring = ST_MakeLine(v_points::geometry[])::geography,
    actual_route_last_updated = NOW()
  WHERE id = p_route_id;
  
  -- Calculate actual distance
  SELECT ST_Length(ST_MakeLine(v_points::geometry[])::geography)
  INTO v_actual_distance;
  
  -- Get planned distance
  IF v_route.traffic_distance_meters IS NOT NULL THEN
    v_planned_distance := v_route.traffic_distance_meters;
  ELSIF v_route.route_linestring IS NOT NULL THEN
    v_planned_distance := ST_Length(v_route.route_linestring);
  ELSE
    v_planned_distance := v_actual_distance; -- No planned route, assume same
  END IF;
  
  -- Calculate distance difference
  v_distance_diff := v_actual_distance - v_planned_distance;
  
  -- Calculate duration
  v_actual_duration := EXTRACT(EPOCH FROM (v_route_end - v_route_start)) / 60;
  
  -- Get planned duration
  IF v_route.traffic_duration_minutes IS NOT NULL THEN
    v_planned_duration := v_route.traffic_duration_minutes;
  ELSE
    v_planned_duration := v_actual_duration; -- No planned duration, assume same
  END IF;
  
  v_duration_diff := v_actual_duration - v_planned_duration;
  
  -- Calculate average deviation from planned route
  IF v_route.route_linestring IS NOT NULL AND array_length(v_points, 1) > 0 THEN
    SELECT AVG(
      ST_Distance(
        point::geometry,
        ST_ClosestPoint(v_route.route_linestring::geometry, point::geometry)
      )
    )
    INTO v_deviation_meters
    FROM unnest(v_points) AS point;
  ELSE
    v_deviation_meters := 0;
  END IF;
  
  -- Calculate efficiency score (0-100)
  -- Factors: distance efficiency, time efficiency, route adherence
  DECLARE
    v_distance_efficiency DECIMAL(5, 2);
    v_time_efficiency DECIMAL(5, 2);
    v_route_adherence DECIMAL(5, 2);
  BEGIN
    -- Distance efficiency: how close actual is to planned (100 = perfect match)
    IF v_planned_distance > 0 THEN
      v_distance_efficiency := GREATEST(0, 100 - ABS(v_distance_diff / v_planned_distance * 100));
    ELSE
      v_distance_efficiency := 100;
    END IF;
    
    -- Time efficiency: how close actual time is to planned (100 = perfect match)
    IF v_planned_duration > 0 THEN
      v_time_efficiency := GREATEST(0, 100 - ABS(v_duration_diff / v_planned_duration * 100));
    ELSE
      v_time_efficiency := 100;
    END IF;
    
    -- Route adherence: how close driver stayed to planned route (100 = perfect adherence)
    -- Lower deviation = higher score
    IF v_deviation_meters < 100 THEN
      v_route_adherence := 100;
    ELSIF v_deviation_meters < 500 THEN
      v_route_adherence := 100 - (v_deviation_meters / 5); -- 100m = 80%, 500m = 0%
    ELSE
      v_route_adherence := 0;
    END IF;
    
    -- Weighted average: 40% distance, 30% time, 30% adherence
    v_efficiency_score := (v_distance_efficiency * 0.4) + (v_time_efficiency * 0.3) + (v_route_adherence * 0.3);
  END;
  
  -- Update route with calculated metrics
  UPDATE public.routes
  SET 
    planned_distance_meters = v_planned_distance,
    actual_distance_meters = v_actual_distance,
    distance_difference_meters = v_distance_diff,
    planned_duration_minutes = v_planned_duration,
    actual_duration_minutes = v_actual_duration,
    duration_difference_minutes = v_duration_diff,
    route_deviation_meters = v_deviation_meters,
    route_efficiency_score = v_efficiency_score,
    actual_route_completed = (v_route_end < NOW()),
    actual_route_last_updated = NOW()
  WHERE id = p_route_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to compare planned vs actual route
CREATE OR REPLACE FUNCTION compare_planned_vs_actual_route(
  p_route_id UUID
)
RETURNS TABLE (
  planned_distance_meters DOUBLE PRECISION,
  actual_distance_meters DOUBLE PRECISION,
  distance_difference_meters DOUBLE PRECISION,
  distance_difference_percent DECIMAL(5, 2),
  planned_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  duration_difference_minutes INTEGER,
  duration_difference_percent DECIMAL(5, 2),
  route_deviation_meters DOUBLE PRECISION,
  efficiency_score DECIMAL(5, 2),
  planned_route_linestring GEOGRAPHY,
  actual_route_linestring GEOGRAPHY
) AS $$
DECLARE
  v_route RECORD;
BEGIN
  SELECT 
    r.planned_distance_meters,
    r.actual_distance_meters,
    r.distance_difference_meters,
    r.planned_duration_minutes,
    r.actual_duration_minutes,
    r.duration_difference_minutes,
    r.route_deviation_meters,
    r.route_efficiency_score,
    r.route_linestring as planned_route_linestring,
    r.actual_route_linestring
  INTO v_route
  FROM public.routes r
  WHERE r.id = p_route_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  
  RETURN QUERY SELECT
    v_route.planned_distance_meters,
    v_route.actual_distance_meters,
    v_route.distance_difference_meters,
    CASE 
      WHEN v_route.planned_distance_meters > 0 THEN
        (v_route.distance_difference_meters / v_route.planned_distance_meters) * 100
      ELSE 0
    END as distance_difference_percent,
    v_route.planned_duration_minutes,
    v_route.actual_duration_minutes,
    v_route.duration_difference_minutes,
    CASE 
      WHEN v_route.planned_duration_minutes > 0 THEN
        (v_route.duration_difference_minutes::DECIMAL / v_route.planned_duration_minutes) * 100
      ELSE 0
    END as duration_difference_percent,
    v_route.route_deviation_meters,
    v_route.route_efficiency_score,
    v_route.planned_route_linestring,
    v_route.actual_route_linestring;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN public.routes.actual_route_linestring IS 
  'Actual route geometry built from GPS location data';
COMMENT ON COLUMN public.routes.route_efficiency_score IS 
  'Route efficiency score (0-100) based on distance, time, and adherence to planned route';
COMMENT ON FUNCTION build_actual_route IS 
  'Builds actual route LINESTRING from GPS locations and calculates efficiency metrics';
COMMENT ON FUNCTION compare_planned_vs_actual_route IS 
  'Compares planned route with actual driven route and returns comparison metrics';


