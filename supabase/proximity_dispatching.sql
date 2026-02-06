-- ============================================================================
-- Proximity Dispatching with PostGIS + HOS Filtering
-- Find closest available drivers near a load pickup location
-- ============================================================================

-- Function to find top drivers near a load pickup location with HOS filtering
CREATE OR REPLACE FUNCTION find_nearby_drivers_for_load(
  pickup_lat DECIMAL,
  pickup_lng DECIMAL,
  company_id_param UUID,
  max_radius_meters INTEGER DEFAULT 50000, -- Default 50km radius
  min_drive_hours DECIMAL DEFAULT 4.0, -- Minimum remaining drive time (hours)
  min_on_duty_hours DECIMAL DEFAULT 6.0, -- Minimum remaining on-duty time (hours)
  limit_results INTEGER DEFAULT 3
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  truck_id UUID,
  truck_number TEXT,
  current_latitude DECIMAL,
  current_longitude DECIMAL,
  distance_meters DOUBLE PRECISION,
  distance_miles DOUBLE PRECISION,
  remaining_drive_hours DECIMAL,
  remaining_on_duty_hours DECIMAL,
  current_status TEXT,
  last_location_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  pickup_point GEOGRAPHY;
BEGIN
  -- Create geography point for pickup location
  pickup_point := ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography;
  
  RETURN QUERY
  WITH driver_locations AS (
    -- Get latest location for each active driver
    SELECT DISTINCT ON (el.driver_id)
      el.driver_id,
      el.truck_id,
      el.latitude,
      el.longitude,
      el.timestamp,
      el.location_geography
    FROM public.eld_locations el
    INNER JOIN public.drivers d ON d.id = el.driver_id
    INNER JOIN public.trucks t ON t.id = el.truck_id
    WHERE el.company_id = company_id_param
      AND el.driver_id IS NOT NULL
      AND el.location_geography IS NOT NULL
      AND d.status = 'active'
      AND t.status IN ('available', 'in_use')
      -- Only consider locations within radius
      AND ST_DWithin(el.location_geography, pickup_point, max_radius_meters)
      -- Only recent locations (last 2 hours)
      AND el.timestamp >= NOW() - INTERVAL '2 hours'
    ORDER BY el.driver_id, el.timestamp DESC
  ),
  driver_hos AS (
    -- Calculate HOS for each driver using rolling windows
    SELECT 
      dl.driver_id,
      dl.truck_id,
      dl.latitude,
      dl.longitude,
      dl.timestamp,
      dl.location_geography,
      -- Get current status and start time from latest open log
      COALESCE(current_log.log_type, 'off_duty') as current_status,
      COALESCE(current_log.start_time, NOW()) as current_status_start_time,
      -- Calculate remaining drive time (11-hour rolling window)
      -- Sum all driving time in last 11 hours from closed logs
      -- Plus current driving session if currently driving
      GREATEST(0, 11 - (
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN duration_minutes IS NOT NULL THEN duration_minutes::DECIMAL / 60.0
              WHEN end_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0
              ELSE 0
            END
          )
          FROM public.eld_logs
          WHERE driver_id = dl.driver_id
            AND log_type = 'driving'
            AND start_time >= NOW() - INTERVAL '11 hours'
            AND end_time IS NOT NULL
        ), 0) +
        -- Add current driving session if currently driving
        CASE 
          WHEN current_log.log_type = 'driving' AND current_log.start_time IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - current_log.start_time)) / 3600.0
          ELSE 0
        END
      )) as remaining_drive_hours,
      -- Calculate remaining on-duty time (14-hour rolling window)
      -- Sum all on-duty/driving time in last 14 hours from closed logs
      -- Plus current on-duty/driving session if currently on-duty
      GREATEST(0, 14 - (
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN duration_minutes IS NOT NULL THEN duration_minutes::DECIMAL / 60.0
              WHEN end_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0
              ELSE 0
            END
          )
          FROM public.eld_logs
          WHERE driver_id = dl.driver_id
            AND log_type IN ('driving', 'on_duty')
            AND start_time >= NOW() - INTERVAL '14 hours'
            AND end_time IS NOT NULL
        ), 0) +
        -- Add current on-duty/driving session if currently on-duty or driving
        CASE 
          WHEN current_log.log_type IN ('driving', 'on_duty') AND current_log.start_time IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - current_log.start_time)) / 3600.0
          ELSE 0
        END
      )) as remaining_on_duty_hours
    FROM driver_locations dl
    LEFT JOIN LATERAL (
      SELECT log_type, start_time
      FROM public.eld_logs
      WHERE driver_id = dl.driver_id
        AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    ) current_log ON true
  )
  SELECT 
    d.id as driver_id,
    d.name as driver_name,
    t.id as truck_id,
    t.truck_number,
    hos.current_latitude,
    hos.current_longitude,
    ST_Distance(hos.location_geography, pickup_point) as distance_meters,
    (ST_Distance(hos.location_geography, pickup_point) / 1609.34) as distance_miles,
    hos.remaining_drive_hours,
    hos.remaining_on_duty_hours,
    hos.current_status,
    hos.timestamp as last_location_timestamp
  FROM driver_hos hos
  INNER JOIN public.drivers d ON d.id = hos.driver_id
  INNER JOIN public.trucks t ON t.id = hos.truck_id
  WHERE hos.remaining_drive_hours >= min_drive_hours
    AND hos.remaining_on_duty_hours >= min_on_duty_hours
    -- Exclude drivers who are currently off-duty for too long (might be on break)
    AND NOT (hos.current_status = 'off_duty' AND hos.timestamp < NOW() - INTERVAL '4 hours')
  ORDER BY ST_Distance(hos.location_geography, pickup_point)
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get load pickup coordinates from address
-- This can be used to geocode the pickup address first
CREATE OR REPLACE FUNCTION get_load_pickup_coordinates(load_id UUID)
RETURNS TABLE (
  latitude DECIMAL,
  longitude DECIMAL,
  address TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN l.shipper_latitude IS NOT NULL THEN l.shipper_latitude
      WHEN l.origin_coordinates IS NOT NULL THEN (l.origin_coordinates->>'lat')::DECIMAL
      ELSE NULL
    END as latitude,
    CASE 
      WHEN l.shipper_longitude IS NOT NULL THEN l.shipper_longitude
      WHEN l.origin_coordinates IS NOT NULL THEN (l.origin_coordinates->>'lng')::DECIMAL
      ELSE NULL
    END as longitude,
    COALESCE(
      l.shipper_address || ', ' || l.shipper_city || ', ' || l.shipper_state || ' ' || l.shipper_zip,
      l.origin
    ) as address
  FROM public.loads l
  WHERE l.id = load_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION find_nearby_drivers_for_load IS 
  'Find top N drivers near a load pickup location who have sufficient HOS remaining. Uses PostGIS ST_Distance for accurate proximity calculation.';
COMMENT ON FUNCTION get_load_pickup_coordinates IS 
  'Extract pickup coordinates from a load record (checks multiple possible fields)';

