-- ============================================================================
-- PostGIS Migration for Location Tracking
-- ============================================================================
-- This migration adds PostGIS support to location tables
-- Run this AFTER enabling PostGIS extension in Supabase Dashboard
-- ============================================================================

-- Step 1: Ensure PostGIS extension is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Add geography column to eld_locations table
-- Using GEOGRAPHY type (WGS84) for accurate distance calculations on Earth's surface
ALTER TABLE public.eld_locations 
  ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);

-- Step 3: Migrate existing latitude/longitude data to PostGIS geography
-- This creates a Point from existing lat/lng columns
UPDATE public.eld_locations
SET location_geography = ST_SetSRID(
  ST_MakePoint(longitude, latitude), 
  4326
)::geography
WHERE location_geography IS NULL 
  AND latitude IS NOT NULL 
  AND longitude IS NOT NULL;

-- Step 4: Create spatial index for fast location queries
CREATE INDEX IF NOT EXISTS idx_eld_locations_geography 
  ON public.eld_locations 
  USING GIST (location_geography);

-- Step 5: Create function to automatically update geography when lat/lng changes
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

-- Step 6: Create trigger to auto-update geography column
DROP TRIGGER IF EXISTS trigger_update_eld_location_geography ON public.eld_locations;
CREATE TRIGGER trigger_update_eld_location_geography
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.eld_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_eld_location_geography();

-- Step 7: Add geography column to geofences table (for circle zones)
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS center_geography GEOGRAPHY(POINT, 4326);

-- Step 8: Migrate existing geofence center coordinates
UPDATE public.geofences
SET center_geography = ST_SetSRID(
  ST_MakePoint(center_longitude, center_latitude), 
  4326
)::geography
WHERE center_geography IS NULL 
  AND center_latitude IS NOT NULL 
  AND center_longitude IS NOT NULL
  AND zone_type = 'circle';

-- Step 9: Create spatial index for geofences
CREATE INDEX IF NOT EXISTS idx_geofences_center_geography 
  ON public.geofences 
  USING GIST (center_geography)
  WHERE center_geography IS NOT NULL;

-- Step 10: Add geography column for polygon geofences
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS polygon_geography GEOGRAPHY(POLYGON, 4326);

-- Step 11: Function to create polygon from JSONB coordinates
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

-- Step 12: Migrate polygon geofences
UPDATE public.geofences
SET polygon_geography = create_polygon_from_jsonb(polygon_coordinates)
WHERE polygon_geography IS NULL 
  AND polygon_coordinates IS NOT NULL 
  AND zone_type = 'polygon';

-- Step 13: Create index for polygon geofences
CREATE INDEX IF NOT EXISTS idx_geofences_polygon_geography 
  ON public.geofences 
  USING GIST (polygon_geography)
  WHERE polygon_geography IS NOT NULL;

-- Step 14: Add geography columns to other location tables
-- Load delivery points
ALTER TABLE public.load_delivery_points
  ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);

-- Route stops
ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);

-- Customers (if coordinates exist in JSONB)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(POINT, 4326);

-- Step 15: Create helper function to find locations within radius
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

-- Step 16: Create function to check if point is in geofence
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

-- Step 18: Add comments for documentation
COMMENT ON COLUMN public.eld_locations.location_geography IS 
  'PostGIS geography point for spatial queries and distance calculations';
COMMENT ON COLUMN public.geofences.center_geography IS 
  'PostGIS geography point for circle geofence center';
COMMENT ON COLUMN public.geofences.polygon_geography IS 
  'PostGIS geography polygon for polygon geofences';
COMMENT ON FUNCTION find_locations_within_radius IS 
  'Find all ELD locations within a specified radius using PostGIS spatial queries';
COMMENT ON FUNCTION is_point_in_geofence IS 
  'Check if a point (lat/lng) is within a geofence using PostGIS';
COMMENT ON FUNCTION calculate_distance_postgis IS 
  'Calculate distance between two points using PostGIS (returns meters)';

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- Your location tables now have PostGIS support with:
-- - Geography columns for spatial data
-- - Spatial indexes (GIST) for fast queries
-- - Helper functions for common spatial operations
-- - Automatic updates when lat/lng changes
-- ============================================================================

