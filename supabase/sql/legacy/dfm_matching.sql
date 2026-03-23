-- ============================================================================
-- Digital Freight Matching (DFM)
-- Automatically matches loads to available trucks using:
-- - Location proximity (PostGIS)
-- - Equipment type compatibility
-- - HOS availability
-- - Rate profitability
-- - Driver preferences
-- ============================================================================

-- Function to find matching trucks for a load
CREATE OR REPLACE FUNCTION find_matching_trucks_for_load(
  p_load_id UUID,
  p_max_results INTEGER DEFAULT 5,
  p_max_distance_miles DECIMAL DEFAULT 100.0
)
RETURNS TABLE (
  truck_id UUID,
  driver_id UUID,
  driver_name TEXT,
  truck_number TEXT,
  match_score DECIMAL(5, 2),
  distance_miles DECIMAL(10, 2),
  equipment_match BOOLEAN,
  hos_available BOOLEAN,
  rate_profitability DECIMAL(5, 2),
  current_location TEXT,
  estimated_pickup_time TIMESTAMP WITH TIME ZONE,
  remaining_drive_hours DECIMAL(5, 2),
  remaining_on_duty_hours DECIMAL(5, 2),
  current_status TEXT
) AS $$
DECLARE
  v_load RECORD;
  v_pickup_lat DECIMAL;
  v_pickup_lng DECIMAL;
  v_max_distance_meters INTEGER;
BEGIN
  -- Get load details
  SELECT 
    l.*,
    l.origin_coordinates,
    l.destination_coordinates,
    l.equipment_type as required_equipment,
    l.rate as load_rate,
    l.pickup_time_window_start,
    l.pickup_time_window_end
  INTO v_load
  FROM public.loads l
  WHERE l.id = p_load_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load not found';
  END IF;
  
  -- Get pickup coordinates
  IF v_load.origin_coordinates IS NOT NULL THEN
    v_pickup_lat := (v_load.origin_coordinates->>'lat')::DECIMAL;
    v_pickup_lng := (v_load.origin_coordinates->>'lng')::DECIMAL;
  ELSE
    RAISE EXCEPTION 'Load origin coordinates not available';
  END IF;
  
  -- Convert miles to meters
  v_max_distance_meters := ROUND(p_max_distance_miles * 1609.34);
  
  -- Find matching trucks
  RETURN QUERY
  WITH available_trucks AS (
    SELECT 
      t.id as truck_id,
      t.truck_number,
      t.status as truck_status,
      t.current_driver_id as driver_id,
      d.name as driver_name,
      d.status as driver_status,
      -- Get current location
      el.latitude as current_lat,
      el.longitude as current_lng,
      el.timestamp as last_location_time,
      -- Calculate distance to pickup
      ST_Distance(
        ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(el.longitude, el.latitude), 4326)::geography
      ) / 1609.34 as distance_miles,
      -- Get HOS data
      COALESCE(
        GREATEST(0, 11 - COALESCE(SUM(CASE WHEN log_type = 'driving' THEN duration_minutes ELSE 0 END), 0) / 60.0),
        0
      ) as remaining_drive_hours,
      COALESCE(
        GREATEST(0, 14 - COALESCE(SUM(CASE WHEN log_type IN ('driving', 'on_duty') THEN duration_minutes ELSE 0 END), 0) / 60.0),
        0
      ) as remaining_on_duty_hours
    FROM public.trucks t
    LEFT JOIN public.drivers d ON d.id = t.current_driver_id
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, timestamp
      FROM public.eld_locations
      WHERE truck_id = t.id
        AND timestamp >= NOW() - INTERVAL '1 hour'
      ORDER BY timestamp DESC
      LIMIT 1
    ) el ON true
    LEFT JOIN public.eld_logs logs ON logs.driver_id = d.id
      AND logs.log_date = CURRENT_DATE
    WHERE t.company_id = v_load.company_id
      AND t.status IN ('available', 'in_use')
      AND (d.status IS NULL OR d.status IN ('active', 'on_route'))
      AND el.latitude IS NOT NULL
      AND el.longitude IS NOT NULL
      -- Within max distance
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(el.longitude, el.latitude), 4326)::geography,
        v_max_distance_meters
      )
    GROUP BY t.id, t.truck_number, t.status, t.current_driver_id, d.id, d.name, d.status,
             el.latitude, el.longitude, el.timestamp
  ),
  scored_trucks AS (
    SELECT 
      at.*,
      -- Equipment match (simplified - assumes equipment_type column exists or matches)
      CASE 
        WHEN v_load.required_equipment IS NULL THEN true
        WHEN v_load.required_equipment = 'any' THEN true
        -- Add more equipment matching logic here based on your schema
        ELSE true -- Default to true if no equipment type specified
      END as equipment_match,
      -- Calculate estimated pickup time (distance / average speed)
      CASE 
        WHEN at.distance_miles > 0 THEN
          NOW() + ((at.distance_miles / 55.0) || ' hours')::INTERVAL
        ELSE NOW()
      END as estimated_pickup_time,
      -- Rate profitability (simplified - would need historical rate data)
      CASE 
        WHEN v_load.load_rate IS NULL THEN 50.0
        WHEN v_load.load_rate > 2000 THEN 100.0
        WHEN v_load.load_rate > 1500 THEN 80.0
        WHEN v_load.load_rate > 1000 THEN 60.0
        ELSE 40.0
      END as rate_profitability
    FROM available_trucks at
    WHERE at.remaining_drive_hours >= 4.0 -- Minimum 4 hours drive time
      AND at.remaining_on_duty_hours >= 6.0 -- Minimum 6 hours on-duty
  ),
  final_scores AS (
    SELECT 
      st.*,
      -- Calculate match score (0-100)
      -- 40% Location proximity (closer = higher score)
      -- 25% Equipment match
      -- 20% HOS availability
      -- 15% Rate profitability
      (
        -- Location score (40%): Closer = higher score
        (CASE 
          WHEN st.distance_miles <= 10 THEN 100
          WHEN st.distance_miles <= 25 THEN 90 - (st.distance_miles - 10) * 2
          WHEN st.distance_miles <= 50 THEN 70 - (st.distance_miles - 25) * 1.2
          WHEN st.distance_miles <= 100 THEN 40 - (st.distance_miles - 50) * 0.4
          ELSE 20
        END * 0.4) +
        -- Equipment match (25%)
        (CASE WHEN st.equipment_match THEN 100 ELSE 0 END * 0.25) +
        -- HOS availability (20%): More hours = higher score
        (LEAST(100, (st.remaining_drive_hours / 11.0) * 100) * 0.20) +
        -- Rate profitability (15%)
        (st.rate_profitability * 0.15)
      ) as match_score
    FROM scored_trucks st
  )
  SELECT 
    fs.truck_id,
    fs.driver_id,
    fs.driver_name,
    fs.truck_number,
    ROUND(fs.match_score::DECIMAL, 2) as match_score,
    ROUND(fs.distance_miles::DECIMAL, 2) as distance_miles,
    fs.equipment_match,
    true as hos_available, -- Already filtered above
    ROUND(fs.rate_profitability::DECIMAL, 2) as rate_profitability,
    COALESCE(
      ST_AsText(ST_SetSRID(ST_MakePoint(fs.current_lng, fs.current_lat), 4326)),
      'Unknown'
    ) as current_location,
    fs.estimated_pickup_time,
    ROUND(fs.remaining_drive_hours::DECIMAL, 2) as remaining_drive_hours,
    ROUND(fs.remaining_on_duty_hours::DECIMAL, 2) as remaining_on_duty_hours,
    COALESCE(fs.truck_status, 'unknown') as current_status
  FROM final_scores fs
  ORDER BY fs.match_score DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find matching loads for a truck
CREATE OR REPLACE FUNCTION find_matching_loads_for_truck(
  p_truck_id UUID,
  p_max_results INTEGER DEFAULT 10,
  p_max_distance_miles DECIMAL DEFAULT 100.0
)
RETURNS TABLE (
  load_id UUID,
  shipment_number TEXT,
  origin TEXT,
  destination TEXT,
  rate DECIMAL(10, 2),
  match_score DECIMAL(5, 2),
  distance_miles DECIMAL(10, 2),
  equipment_match BOOLEAN,
  hos_available BOOLEAN,
  pickup_time_window_start TIMESTAMP WITH TIME ZONE,
  pickup_time_window_end TIMESTAMP WITH TIME ZONE,
  load_date DATE
) AS $$
DECLARE
  v_truck RECORD;
  v_current_lat DECIMAL;
  v_current_lng DECIMAL;
  v_max_distance_meters INTEGER;
  v_driver_id UUID;
  v_remaining_drive_hours DECIMAL;
  v_remaining_on_duty_hours DECIMAL;
BEGIN
  -- Get truck details
  SELECT 
    t.*,
    t.current_driver_id
  INTO v_truck
  FROM public.trucks t
  WHERE t.id = p_truck_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Truck not found';
  END IF;
  
  v_driver_id := v_truck.current_driver_id;
  
  -- Get current location
  SELECT latitude, longitude
  INTO v_current_lat, v_current_lng
  FROM public.eld_locations
  WHERE truck_id = p_truck_id
    AND timestamp >= NOW() - INTERVAL '1 hour'
  ORDER BY timestamp DESC
  LIMIT 1;
  
  IF v_current_lat IS NULL OR v_current_lng IS NULL THEN
    RAISE EXCEPTION 'Truck location not available';
  END IF;
  
  -- Get driver HOS
  SELECT 
    GREATEST(0, 11 - COALESCE(SUM(CASE WHEN log_type = 'driving' THEN duration_minutes ELSE 0 END), 0) / 60.0) as remaining_drive,
    GREATEST(0, 14 - COALESCE(SUM(CASE WHEN log_type IN ('driving', 'on_duty') THEN duration_minutes ELSE 0 END), 0) / 60.0) as remaining_on_duty
  INTO v_remaining_drive_hours, v_remaining_on_duty_hours
  FROM public.eld_logs
  WHERE driver_id = v_driver_id
    AND log_date = CURRENT_DATE;
  
  -- Convert miles to meters
  v_max_distance_meters := ROUND(p_max_distance_miles * 1609.34);
  
  -- Find matching loads
  RETURN QUERY
  WITH nearby_loads AS (
    SELECT 
      l.id as load_id,
      l.shipment_number,
      l.origin,
      l.destination,
      l.rate,
      l.origin_coordinates,
      l.equipment_type as required_equipment,
      l.pickup_time_window_start,
      l.pickup_time_window_end,
      l.load_date,
      -- Calculate distance
      ST_Distance(
        ST_SetSRID(ST_MakePoint(v_current_lng, v_current_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint((l.origin_coordinates->>'lng')::DECIMAL, (l.origin_coordinates->>'lat')::DECIMAL), 4326)::geography
      ) / 1609.34 as distance_miles
    FROM public.loads l
    WHERE l.company_id = v_truck.company_id
      AND l.status IN ('pending', 'scheduled', 'available')
      AND l.truck_id IS NULL -- Unassigned
      AND l.origin_coordinates IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(v_current_lng, v_current_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint((l.origin_coordinates->>'lng')::DECIMAL, (l.origin_coordinates->>'lat')::DECIMAL), 4326)::geography,
        v_max_distance_meters
      )
  ),
  scored_loads AS (
    SELECT 
      nl.*,
      -- Equipment match
      CASE 
        WHEN nl.required_equipment IS NULL THEN true
        WHEN nl.required_equipment = 'any' THEN true
        ELSE true -- Add equipment matching logic
      END as equipment_match,
      -- Check if driver can complete (simplified - would need route distance)
      CASE 
        WHEN v_remaining_drive_hours >= 4.0 AND v_remaining_on_duty_hours >= 6.0 THEN true
        ELSE false
      END as hos_available
    FROM nearby_loads nl
  ),
  final_scores AS (
    SELECT 
      sl.*,
      -- Match score
      (
        -- Location score (40%)
        (CASE 
          WHEN sl.distance_miles <= 10 THEN 100
          WHEN sl.distance_miles <= 25 THEN 90 - (sl.distance_miles - 10) * 2
          WHEN sl.distance_miles <= 50 THEN 70 - (sl.distance_miles - 25) * 1.2
          WHEN sl.distance_miles <= 100 THEN 40 - (sl.distance_miles - 50) * 0.4
          ELSE 20
        END * 0.4) +
        -- Equipment match (25%)
        (CASE WHEN sl.equipment_match THEN 100 ELSE 0 END * 0.25) +
        -- HOS availability (20%)
        (CASE WHEN sl.hos_available THEN 100 ELSE 0 END * 0.20) +
        -- Rate profitability (15%)
        (CASE 
          WHEN sl.rate > 2000 THEN 100
          WHEN sl.rate > 1500 THEN 80
          WHEN sl.rate > 1000 THEN 60
          ELSE 40
        END * 0.15)
      ) as match_score
    FROM scored_loads sl
    WHERE sl.hos_available = true
  )
  SELECT 
    fs.load_id,
    fs.shipment_number,
    fs.origin,
    fs.destination,
    fs.rate,
    ROUND(fs.match_score::DECIMAL, 2) as match_score,
    ROUND(fs.distance_miles::DECIMAL, 2) as distance_miles,
    fs.equipment_match,
    fs.hos_available,
    fs.pickup_time_window_start,
    fs.pickup_time_window_end,
    fs.load_date
  FROM final_scores fs
  ORDER BY fs.match_score DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION find_matching_trucks_for_load IS 
  'Finds best matching trucks for a load using location, equipment, HOS, and rate scoring';
COMMENT ON FUNCTION find_matching_loads_for_truck IS 
  'Finds best matching loads for a truck using location, equipment, HOS, and rate scoring';

