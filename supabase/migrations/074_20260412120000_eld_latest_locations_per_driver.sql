-- One row per driver: latest eld_locations ping (avoids scanning 800 arbitrary rows in app code).
CREATE OR REPLACE FUNCTION public.get_latest_eld_locations_for_drivers(
  p_company_id uuid,
  p_driver_ids uuid[]
)
RETURNS TABLE (
  driver_id uuid,
  "timestamp" timestamptz,
  address text,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (l.driver_id)
    l.driver_id,
    l.timestamp,
    l.address,
    l.latitude::double precision,
    l.longitude::double precision
  FROM public.eld_locations l
  WHERE l.company_id = p_company_id
    AND l.driver_id IS NOT NULL
    AND (p_driver_ids IS NULL OR cardinality(p_driver_ids) = 0 OR l.driver_id = ANY(p_driver_ids))
  ORDER BY l.driver_id, l.timestamp DESC;
$$;

COMMENT ON FUNCTION public.get_latest_eld_locations_for_drivers(uuid, uuid[]) IS
  'Latest GPS row per driver for fleet HOS map (DISTINCT ON).';

GRANT EXECUTE ON FUNCTION public.get_latest_eld_locations_for_drivers(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_eld_locations_for_drivers(uuid, uuid[]) TO service_role;
