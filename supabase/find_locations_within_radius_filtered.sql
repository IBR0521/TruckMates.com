-- Bounded variant of `find_locations_within_radius` to prevent unbounded
-- `eld_locations` reads as the table grows.
--
-- Used by `app/actions/location-queries.ts`.
CREATE OR REPLACE FUNCTION public.find_locations_within_radius_filtered(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_meters INTEGER,
  start_time TIMESTAMPTZ DEFAULT NULL,
  end_time TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_meters DOUBLE PRECISION,
  location_timestamp TIMESTAMPTZ
)
AS $$
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
    AND (start_time IS NULL OR el.timestamp >= start_time)
    AND (end_time IS NULL OR el.timestamp <= end_time)
  ORDER BY el.location_geography <-> center_point
  LIMIT COALESCE(p_limit, 200);
END;
$$ LANGUAGE plpgsql;

