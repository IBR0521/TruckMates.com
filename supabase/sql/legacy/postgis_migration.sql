-- ============================================================================
-- PostGIS Migration for Location Tracking
-- ============================================================================
-- This migration adds PostGIS support to location tables
-- Run this AFTER enabling PostGIS extension in Supabase Dashboard
-- ============================================================================

-- Step 1: Ensure PostGIS extension is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Add geography column to eld_locations table (only if table exists)
-- Using GEOGRAPHY type (WGS84) for accurate distance calculations on Earth's surface
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_locations') THEN
    ALTER TABLE public.eld_locations 
      ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);

    -- Migrate existing latitude/longitude data to PostGIS geography
    UPDATE public.eld_locations
    SET location_geography = ST_SetSRID(
      ST_MakePoint(longitude, latitude), 
      4326
    )::geography
    WHERE location_geography IS NULL 
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL;

    -- Create spatial index for fast location queries
    CREATE INDEX IF NOT EXISTS idx_eld_locations_geography 
      ON public.eld_locations 
      USING GIST (location_geography);
  END IF;
END $$;

-- Step 3: Create function to automatically update geography when lat/lng changes
CREATE OR REPLACE FUNCTION update_eld_location_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_geography = ST_SetSRID(
      ST_MakePoint(NEW.longitude, NEW.latitude), 
      4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to auto-update geography column (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_locations') THEN
    DROP TRIGGER IF EXISTS trigger_update_eld_location_geography ON public.eld_locations;
    CREATE TRIGGER trigger_update_eld_location_geography
      BEFORE INSERT OR UPDATE OF latitude, longitude ON public.eld_locations
      FOR EACH ROW
      EXECUTE FUNCTION update_eld_location_geography();
  END IF;
END $$;

-- Step 7: Add geography column to geofences table (for circle zones)
-- Only if geofences table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences') THEN
    ALTER TABLE public.geofences
      ADD COLUMN IF NOT EXISTS center_geography GEOGRAPHY(POINT, 4326);

    -- Migrate existing geofence center coordinates
    UPDATE public.geofences
    SET center_geography = ST_SetSRID(
      ST_MakePoint(center_longitude, center_latitude), 
      4326
    )::geography
    WHERE center_geography IS NULL 
      AND center_latitude IS NOT NULL 
      AND center_longitude IS NOT NULL
      AND zone_type = 'circle';

    -- Create spatial index for geofences
    CREATE INDEX IF NOT EXISTS idx_geofences_center_geography 
      ON public.geofences 
      USING GIST (center_geography)
      WHERE center_geography IS NOT NULL;

    -- Add geography column for polygon geofences
    ALTER TABLE public.geofences
      ADD COLUMN IF NOT EXISTS polygon_geography GEOGRAPHY(POLYGON, 4326);
  END IF;
END $$;

-- Step 8: Function to create polygon from JSONB coordinates
CREATE OR REPLACE FUNCTION create_polygon_from_jsonb(coords JSONB)
RETURNS GEOGRAPHY AS $$
DECLARE
  points TEXT;
  coord JSONB;
BEGIN
  IF coords IS NULL OR jsonb_array_length(coords) < 3 THEN
    RETURN NULL;
  END IF;
  
  -- Build polygon string from coordinates
  points := '';
  FOR coord IN SELECT * FROM jsonb_array_elements(coords)
  LOOP
    points := points || coord->>'lng' || ' ' || coord->>'lat' || ',';
  END LOOP;
  
  -- Close the polygon (first point = last point)
  points := points || (coords->0->>'lng') || ' ' || (coords->0->>'lat');
  
  RETURN ST_GeogFromText('POLYGON((' || points || '))', 4326);
END;
$$ LANGUAGE plpgsql;

-- Step 9: Migrate polygon geofences (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences') THEN
    UPDATE public.geofences
    SET polygon_geography = create_polygon_from_jsonb(polygon_coordinates)
    WHERE polygon_geography IS NULL 
      AND polygon_coordinates IS NOT NULL 
      AND zone_type = 'polygon';

    -- Create index for polygon geofences
    CREATE INDEX IF NOT EXISTS idx_geofences_polygon_geography 
      ON public.geofences 
      USING GIST (polygon_geography)
      WHERE polygon_geography IS NOT NULL;
  END IF;
END $$;

-- Step 10: Add geography columns to other location tables (only if they exist)
DO $$
BEGIN
  -- Load delivery points
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'load_delivery_points') THEN
    ALTER TABLE public.load_delivery_points
      ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);
  END IF;

  -- Route stops
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'route_stops') THEN
    ALTER TABLE public.route_stops
      ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);
  END IF;

  -- Customers (if coordinates exist in JSONB)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    ALTER TABLE public.customers
      ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);
  END IF;
END $$;

-- Step 11: Create helper function to find locations within radius
-- Note: Function will only work after eld_locations table is created
CREATE OR REPLACE FUNCTION find_locations_within_radius(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_meters INTEGER
)
RETURNS TABLE (
  id UUID,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_meters DOUBLE PRECISION,
  location_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  center_point GEOGRAPHY;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_locations') THEN
    RAISE EXCEPTION 'Table eld_locations does not exist. Please run eld_schema.sql first.';
  END IF;

  center_point := ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography;
  
  RETURN QUERY
  SELECT 
    el.id,
    el.latitude,
    el.longitude,
    ST_Distance(el.location_geography, center_point) AS distance_meters,
    el.timestamp AS location_timestamp
  FROM public.eld_locations el
  WHERE el.location_geography IS NOT NULL
    AND ST_DWithin(el.location_geography, center_point, radius_meters)
  ORDER BY el.location_geography <-> center_point;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create function to check if point is in geofence
-- Note: Function will only work after geofences table is created
CREATE OR REPLACE FUNCTION is_point_in_geofence(
  point_lat DECIMAL,
  point_lng DECIMAL,
  geofence_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  point_geog GEOGRAPHY;
  geofence_record RECORD;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences') THEN
    RAISE EXCEPTION 'Table geofences does not exist. Please run geofencing_schema.sql first.';
  END IF;

  point_geog := ST_SetSRID(ST_MakePoint(point_lng, point_lat), 4326)::geography;
  
  SELECT * INTO geofence_record
  FROM public.geofences
  WHERE id = geofence_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check circle geofence
  IF geofence_record.zone_type = 'circle' AND geofence_record.center_geography IS NOT NULL THEN
    RETURN ST_DWithin(
      point_geog, 
      geofence_record.center_geography, 
      geofence_record.radius_meters
    );
  END IF;
  
  -- Check polygon geofence
  IF geofence_record.zone_type = 'polygon' AND geofence_record.polygon_geography IS NOT NULL THEN
    RETURN ST_Within(point_geog::geometry, geofence_record.polygon_geography::geometry);
  END IF;
  
  -- Check rectangle geofence (using bounds)
  IF geofence_record.zone_type = 'rectangle' THEN
    RETURN point_lat >= geofence_record.south_bound 
      AND point_lat <= geofence_record.north_bound
      AND point_lng >= geofence_record.west_bound 
      AND point_lng <= geofence_record.east_bound;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Step 17: Create function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance_postgis(
  lat1 DECIMAL,
  lng1 DECIMAL,
  lat2 DECIMAL,
  lng2 DECIMAL
)
RETURNS TABLE (
  distance_meters DOUBLE PRECISION
) AS $$
DECLARE
  point1 GEOGRAPHY;
  point2 GEOGRAPHY;
BEGIN
  point1 := ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography;
  point2 := ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography;
  
  RETURN QUERY
  SELECT ST_Distance(point1, point2) AS distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Add comments for documentation (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_locations') THEN
    COMMENT ON COLUMN public.eld_locations.location_geography IS 
      'PostGIS geography point for spatial queries and distance calculations';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences') THEN
    COMMENT ON COLUMN public.geofences.center_geography IS 
      'PostGIS geography point for circle geofence center';
    COMMENT ON COLUMN public.geofences.polygon_geography IS 
      'PostGIS geography polygon for polygon geofences';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'find_locations_within_radius') THEN
    COMMENT ON FUNCTION find_locations_within_radius IS 
      'Find all ELD locations within a specified radius using PostGIS spatial queries';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'is_point_in_geofence') THEN
    COMMENT ON FUNCTION is_point_in_geofence IS 
      'Check if a point (lat/lng) is within a geofence using PostGIS';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'calculate_distance_postgis') THEN
    COMMENT ON FUNCTION calculate_distance_postgis IS 
      'Calculate distance between two points using PostGIS (returns meters)';
  END IF;
END $$;

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- Your location tables now have PostGIS support with:
-- - Geography columns for spatial data
-- - Spatial indexes (GIST) for fast queries
-- - Helper functions for common spatial operations
-- - Automatic updates when lat/lng changes
-- ============================================================================

