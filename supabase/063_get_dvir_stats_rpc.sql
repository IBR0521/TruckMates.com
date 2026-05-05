-- RPC function to get DVIR statistics efficiently
-- Replaces client-side aggregation with server-side SQL for better performance

CREATE OR REPLACE FUNCTION get_dvir_stats(
  p_company_id UUID,
  p_driver_id UUID DEFAULT NULL,
  p_truck_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'passed', COUNT(*) FILTER (WHERE status = 'passed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'defects_corrected', COUNT(*) FILTER (WHERE status = 'defects_corrected'),
    'with_defects', COUNT(*) FILTER (WHERE defects_found = true),
    'unsafe', COUNT(*) FILTER (WHERE safe_to_operate = false),
    'pre_trip', COUNT(*) FILTER (WHERE inspection_type = 'pre_trip'),
    'post_trip', COUNT(*) FILTER (WHERE inspection_type = 'post_trip'),
    'on_road', COUNT(*) FILTER (WHERE inspection_type = 'on_road')
  ) INTO v_stats
  FROM public.dvir
  WHERE company_id = p_company_id
    AND (p_driver_id IS NULL OR driver_id = p_driver_id)
    AND (p_truck_id IS NULL OR truck_id = p_truck_id)
    AND (p_start_date IS NULL OR inspection_date >= p_start_date)
    AND (p_end_date IS NULL OR inspection_date <= p_end_date);
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_dvir_stats IS 'Efficiently calculates DVIR statistics using server-side aggregation';

