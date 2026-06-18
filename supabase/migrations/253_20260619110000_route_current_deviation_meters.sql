-- Live route deviation for in-progress routes (separate from post-completion route_deviation_meters).

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS current_deviation_meters DOUBLE PRECISION;

COMMENT ON COLUMN public.routes.current_deviation_meters IS
  'Perpendicular distance (meters) from latest truck position to planned path while status = in_progress.';

CREATE OR REPLACE FUNCTION public.update_current_route_deviation_for_truck(
  p_company_id UUID,
  p_truck_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_point geography;
BEGIN
  IF p_company_id IS NULL OR p_truck_id IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    RETURN;
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  UPDATE public.routes r
  SET
    current_deviation_meters = ST_Distance(
      v_point,
      COALESCE(r.traffic_aware_route_linestring, r.route_linestring)
    ),
    updated_at = timezone('utc', now())
  WHERE r.company_id = p_company_id
    AND r.truck_id = p_truck_id
    AND r.status = 'in_progress'
    AND COALESCE(r.traffic_aware_route_linestring, r.route_linestring) IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.update_current_route_deviation_for_truck(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) IS
  'Updates current_deviation_meters on in_progress routes for a truck using planned route_linestring (or traffic_aware_route_linestring).';

REVOKE ALL ON FUNCTION public.update_current_route_deviation_for_truck(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_current_route_deviation_for_truck(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_current_route_deviation_for_truck(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
