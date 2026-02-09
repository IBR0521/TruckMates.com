-- ============================================================================
-- Dispatch Timeline & Gantt Chart - PostGIS Functions
-- ============================================================================
-- Functions for calculating drive times and distances for timeline visualization
-- ============================================================================

-- Function to calculate drive time between two coordinates
-- Uses PostGIS ST_Distance for accurate distance calculation
CREATE OR REPLACE FUNCTION calculate_drive_time(
  origin_lat DECIMAL,
  origin_lng DECIMAL,
  destination_lat DECIMAL,
  destination_lng DECIMAL
)
RETURNS TABLE (
  distance_miles DECIMAL,
  drive_time_minutes INTEGER
) AS $$
DECLARE
  v_origin_point GEOGRAPHY;
  v_dest_point GEOGRAPHY;
  v_distance_meters DECIMAL;
  v_distance_miles DECIMAL;
  v_drive_time_minutes INTEGER;
  v_avg_speed_mph DECIMAL := 55; -- Average truck speed in mph
BEGIN
  -- Create geography points
  v_origin_point := ST_SetSRID(ST_MakePoint(origin_lng, origin_lat), 4326)::GEOGRAPHY;
  v_dest_point := ST_SetSRID(ST_MakePoint(destination_lng, destination_lat), 4326)::GEOGRAPHY;
  
  -- Calculate distance in meters
  v_distance_meters := ST_Distance(v_origin_point, v_dest_point);
  
  -- Convert to miles
  v_distance_miles := v_distance_meters * 0.000621371;
  
  -- Calculate drive time (distance / speed * 60 minutes)
  v_drive_time_minutes := CEIL((v_distance_miles / v_avg_speed_mph) * 60);
  
  -- Add 10% buffer for traffic/rest stops
  v_drive_time_minutes := CEIL(v_drive_time_minutes * 1.1);
  
  RETURN QUERY SELECT v_distance_miles, v_drive_time_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to get drive time between two addresses using coordinates from loads
CREATE OR REPLACE FUNCTION get_drive_time_between_loads(
  load1_id UUID,
  load2_id UUID
)
RETURNS TABLE (
  drive_time_minutes INTEGER,
  distance_miles DECIMAL
) AS $$
DECLARE
  v_load1 RECORD;
  v_load2 RECORD;
  v_origin_lat DECIMAL;
  v_origin_lng DECIMAL;
  v_dest_lat DECIMAL;
  v_dest_lng DECIMAL;
BEGIN
  -- Get load 1 destination coordinates
  SELECT 
    coordinates->>'lat' AS lat,
    coordinates->>'lng' AS lng
  INTO v_load1
  FROM loads
  WHERE id = load1_id;
  
  -- Get load 2 origin coordinates
  SELECT 
    coordinates->>'lat' AS lat,
    coordinates->>'lng' AS lng
  INTO v_load2
  FROM loads
  WHERE id = load2_id;
  
  -- If coordinates exist, calculate drive time
  IF v_load1.lat IS NOT NULL AND v_load1.lng IS NOT NULL AND
     v_load2.lat IS NOT NULL AND v_load2.lng IS NOT NULL THEN
    v_origin_lat := v_load1.lat::DECIMAL;
    v_origin_lng := v_load1.lng::DECIMAL;
    v_dest_lat := v_load2.lat::DECIMAL;
    v_dest_lng := v_load2.lng::DECIMAL;
    
    RETURN QUERY
    SELECT * FROM calculate_drive_time(v_origin_lat, v_origin_lng, v_dest_lat, v_dest_lng);
  ELSE
    -- Return default 8 hours if coordinates not available
    RETURN QUERY SELECT 480, 500.0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a driver can complete a job within HOS limits
CREATE OR REPLACE FUNCTION check_driver_hos_for_timeline(
  p_driver_id UUID,
  p_total_drive_minutes INTEGER,
  p_total_on_duty_minutes INTEGER
)
RETURNS TABLE (
  can_complete BOOLEAN,
  violations TEXT[]
) AS $$
DECLARE
  v_remaining_drive DECIMAL;
  v_remaining_on_duty DECIMAL;
  v_drive_hours DECIMAL;
  v_on_duty_hours DECIMAL;
  v_violations TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get driver's remaining HOS (this would call your existing HOS calculation)
  -- For now, using placeholder - you'll need to integrate with your HOS service
  SELECT 
    COALESCE(remaining_drive_hours, 11) AS remaining_drive,
    COALESCE(remaining_on_duty_hours, 14) AS remaining_on_duty
  INTO v_remaining_drive, v_remaining_on_duty
  FROM (
    -- Placeholder: In production, call your HOS calculation function
    SELECT 11.0 AS remaining_drive_hours, 14.0 AS remaining_on_duty_hours
  ) AS hos_data;
  
  -- Convert minutes to hours
  v_drive_hours := p_total_drive_minutes / 60.0;
  v_on_duty_hours := p_total_on_duty_minutes / 60.0;
  
  -- Check violations
  IF v_drive_hours > v_remaining_drive THEN
    v_violations := array_append(
      v_violations,
      format('Insufficient drive time: Need %.1fh, have %.1fh', v_drive_hours, v_remaining_drive)
    );
  END IF;
  
  IF v_on_duty_hours > v_remaining_on_duty THEN
    v_violations := array_append(
      v_violations,
      format('Insufficient on-duty time: Need %.1fh, have %.1fh', v_on_duty_hours, v_remaining_on_duty)
    );
  END IF;
  
  RETURN QUERY SELECT 
    array_length(v_violations, 1) IS NULL AS can_complete,
    v_violations AS violations;
END;
$$ LANGUAGE plpgsql;

-- Index for faster timeline queries
CREATE INDEX IF NOT EXISTS idx_loads_driver_date ON public.loads(driver_id, load_date, estimated_delivery) 
WHERE driver_id IS NOT NULL AND load_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_routes_driver_date ON public.routes(driver_id, start_date, end_date) 
WHERE driver_id IS NOT NULL AND start_date IS NOT NULL;



