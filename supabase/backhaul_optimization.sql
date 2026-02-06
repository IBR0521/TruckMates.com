-- ============================================================================
-- Backhaul Optimization
-- Find return loads when driver is 2 hours from drop-off
-- Reduces deadhead miles and increases revenue
-- ============================================================================

-- Function to find backhaul opportunities
CREATE OR REPLACE FUNCTION find_backhaul_opportunities(
  p_route_id UUID,
  p_hours_from_dropoff DECIMAL DEFAULT 2.0,
  p_max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  load_id UUID,
  load_number TEXT,
  pickup_address TEXT,
  pickup_latitude DECIMAL,
  pickup_longitude DECIMAL,
  dropoff_address TEXT,
  dropoff_latitude DECIMAL,
  dropoff_longitude DECIMAL,
  distance_from_dropoff_miles DECIMAL,
  distance_to_pickup_miles DECIMAL,
  direction_match_score DECIMAL, -- 0-100, higher = better direction match
  estimated_revenue DECIMAL,
  driver_can_make_it BOOLEAN,
  driver_has_hos BOOLEAN,
  pickup_time_window_start TIMESTAMP WITH TIME ZONE,
  pickup_time_window_end TIMESTAMP WITH TIME ZONE,
  load_weight DECIMAL,
  load_status TEXT
) AS $$
DECLARE
  v_route RECORD;
  v_dropoff_lat DECIMAL;
  v_dropoff_lng DECIMAL;
  v_driver_id UUID;
  v_truck_id UUID;
  v_company_id UUID;
  v_home_base_lat DECIMAL;
  v_home_base_lng DECIMAL;
  v_remaining_drive_hours DECIMAL;
  v_remaining_on_duty_hours DECIMAL;
  v_eta_to_dropoff TIMESTAMP WITH TIME ZONE;
  v_two_hour_radius_meters INTEGER;
BEGIN
  -- Get route details
  SELECT 
    r.*,
    r.destination_coordinates,
    r.truck_id,
    r.driver_id,
    r.company_id,
    r.current_eta
  INTO v_route
  FROM public.routes r
  WHERE r.id = p_route_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  
  v_company_id := v_route.company_id;
  v_driver_id := v_route.driver_id;
  v_truck_id := v_route.truck_id;
  
  -- Get drop-off coordinates
  IF v_route.destination_coordinates IS NOT NULL THEN
    v_dropoff_lat := (v_route.destination_coordinates->>'lat')::DECIMAL;
    v_dropoff_lng := (v_route.destination_coordinates->>'lng')::DECIMAL;
  ELSE
    -- Try to geocode destination (would need application call)
    RAISE EXCEPTION 'Route destination coordinates not available';
  END IF;
  
  -- Get home base coordinates (for direction matching)
  -- Try to get from company address or use drop-off as reference
  -- For now, we'll use the route origin as "home base" reference
  IF v_route.origin_coordinates IS NOT NULL THEN
    v_home_base_lat := (v_route.origin_coordinates->>'lat')::DECIMAL;
    v_home_base_lng := (v_route.origin_coordinates->>'lng')::DECIMAL;
  ELSE
    -- No home base reference, will use neutral scoring
    v_home_base_lat := NULL;
    v_home_base_lng := NULL;
  END IF;
  
  -- Calculate ETA to drop-off
  IF v_route.current_eta IS NOT NULL THEN
    v_eta_to_dropoff := v_route.current_eta;
  ELSE
    -- Estimate based on route distance (fallback)
    v_eta_to_dropoff := NOW() + INTERVAL '2 hours';
  END IF;
  
  -- Calculate 2-hour radius (assuming average 55 MPH = ~110 miles)
  v_two_hour_radius_meters := ROUND(p_hours_from_dropoff * 55 * 1609.34); -- Convert to meters
  
  -- Get driver HOS remaining hours
  SELECT 
    GREATEST(0, 11 - COALESCE(SUM(CASE WHEN log_type = 'driving' THEN duration_minutes ELSE 0 END), 0) / 60.0) as remaining_driving,
    GREATEST(0, 14 - COALESCE(SUM(CASE WHEN log_type IN ('driving', 'on_duty') THEN duration_minutes ELSE 0 END), 0) / 60.0) as remaining_on_duty
  INTO v_remaining_drive_hours, v_remaining_on_duty_hours
  FROM public.eld_logs
  WHERE driver_id = v_driver_id
    AND log_date = CURRENT_DATE;
  
  -- Find unassigned loads within radius
  RETURN QUERY
  WITH nearby_loads AS (
    SELECT 
      l.id,
      l.shipment_number,
      l.origin as pickup_address,
      l.origin_coordinates->>'lat' as pickup_lat,
      l.origin_coordinates->>'lng' as pickup_lng,
      l.destination as dropoff_address,
      l.destination_coordinates->>'lat' as dropoff_lat,
      l.destination_coordinates->>'lng' as dropoff_lng,
      l.load_date,
      l.pickup_time_window_start,
      l.pickup_time_window_end,
      l.weight as load_weight,
      l.status,
      l.rate,
      -- Calculate distance from drop-off to pickup
      ST_Distance(
        ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint((l.origin_coordinates->>'lng')::DECIMAL, (l.origin_coordinates->>'lat')::DECIMAL), 4326)::geography
      ) / 1609.34 as distance_from_dropoff_miles,
      -- Calculate distance from current location to pickup (simplified)
      ST_Distance(
        ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint((l.origin_coordinates->>'lng')::DECIMAL, (l.origin_coordinates->>'lat')::DECIMAL), 4326)::geography
      ) / 1609.34 as distance_to_pickup_miles
    FROM public.loads l
    WHERE l.company_id = v_company_id
      AND l.status IN ('pending', 'scheduled', 'available')
      AND l.truck_id IS NULL -- Unassigned
      AND l.origin_coordinates IS NOT NULL
      AND l.destination_coordinates IS NOT NULL
      -- Within 2-hour radius from drop-off
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(v_dropoff_lng, v_dropoff_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint((l.origin_coordinates->>'lng')::DECIMAL, (l.origin_coordinates->>'lat')::DECIMAL), 4326)::geography,
        v_two_hour_radius_meters
      )
  ),
  scored_loads AS (
    SELECT 
      nl.*,
      -- Calculate direction match score (0-100)
      -- Higher score if backhaul destination is closer to home base
      CASE 
        WHEN v_home_base_lat IS NOT NULL AND v_home_base_lng IS NOT NULL THEN
          -- Calculate how much closer to home base the backhaul gets us
          LEAST(100, GREATEST(0, 
            100 - (
              ST_Distance(
                ST_SetSRID(ST_MakePoint((nl.dropoff_lng)::DECIMAL, (nl.dropoff_lat)::DECIMAL), 4326)::geography,
                ST_SetSRID(ST_MakePoint(v_home_base_lng, v_home_base_lat), 4326)::geography
              ) / 1609.34 / 10 -- Normalize: 10 miles = 1 point deduction
            )
          ))
        ELSE 50 -- Neutral score if no home base
      END as direction_match_score,
      -- Check if driver can make it (has enough HOS)
      CASE 
        WHEN v_remaining_drive_hours IS NULL THEN true -- Assume yes if no HOS data
        WHEN (nl.distance_to_pickup_miles / 55.0) + (nl.distance_to_pickup_miles / 55.0) <= v_remaining_drive_hours THEN true
        ELSE false
      END as driver_can_make_it,
      -- Check if driver has HOS available
      CASE 
        WHEN v_remaining_drive_hours IS NULL THEN true
        WHEN v_remaining_drive_hours >= 4.0 THEN true -- At least 4 hours remaining
        ELSE false
      END as driver_has_hos
    FROM nearby_loads nl
  )
  SELECT 
    sl.id as load_id,
    sl.shipment_number as load_number,
    sl.pickup_address,
    (sl.pickup_lat)::DECIMAL as pickup_latitude,
    (sl.pickup_lng)::DECIMAL as pickup_longitude,
    sl.dropoff_address,
    (sl.dropoff_lat)::DECIMAL as dropoff_latitude,
    (sl.dropoff_lng)::DECIMAL as dropoff_longitude,
    sl.distance_from_dropoff_miles,
    sl.distance_to_pickup_miles,
    sl.direction_match_score,
    COALESCE(sl.rate, 0) as estimated_revenue,
    sl.driver_can_make_it,
    sl.driver_has_hos,
    sl.pickup_time_window_start,
    sl.pickup_time_window_end,
    sl.load_weight,
    sl.status as load_status
  FROM scored_loads sl
  WHERE sl.driver_has_hos = true -- Only show loads driver can actually take
  ORDER BY 
    sl.direction_match_score DESC, -- Best direction match first
    sl.distance_from_dropoff_miles ASC, -- Closest pickup first
    sl.estimated_revenue DESC -- Highest revenue first
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION find_backhaul_opportunities IS 
  'Finds return load opportunities when driver is near drop-off, reducing deadhead miles';

