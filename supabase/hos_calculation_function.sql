-- SQL Function: calculate_remaining_hos
-- Used by Edge Function for automated HOS exception reporting
-- Returns remaining driving/on-duty hours and break requirements

CREATE OR REPLACE FUNCTION public.calculate_remaining_hos(
  p_driver_id UUID
)
RETURNS TABLE (
  remaining_driving DECIMAL(10, 2),
  remaining_on_duty DECIMAL(10, 2),
  needs_break BOOLEAN,
  violations TEXT[]
) AS $$
DECLARE
  v_driving_minutes INTEGER := 0;
  v_on_duty_minutes INTEGER := 0;
  v_off_duty_minutes INTEGER := 0;
  v_sleeper_minutes INTEGER := 0;
  v_driving_hours DECIMAL(10, 2);
  v_on_duty_hours DECIMAL(10, 2);
  v_off_duty_hours DECIMAL(10, 2);
  v_remaining_driving DECIMAL(10, 2);
  v_remaining_on_duty DECIMAL(10, 2);
  v_needs_break BOOLEAN := false;
  v_violations TEXT[] := ARRAY[]::TEXT[];
  v_log RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get all logs for today
  FOR v_log IN
    SELECT 
      log_type,
      start_time,
      end_time,
      COALESCE(duration_minutes, 
        EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) / 60
      )::INTEGER AS duration
    FROM public.eld_logs
    WHERE driver_id = p_driver_id
      AND DATE(start_time) = v_today
      AND (end_time IS NULL OR DATE(end_time) = v_today)
    ORDER BY start_time ASC
  LOOP
    -- Accumulate minutes by log type
    CASE v_log.log_type
      WHEN 'driving' THEN
        v_driving_minutes := v_driving_minutes + v_log.duration;
        v_on_duty_minutes := v_on_duty_minutes + v_log.duration;
      WHEN 'on_duty' THEN
        v_on_duty_minutes := v_on_duty_minutes + v_log.duration;
      WHEN 'off_duty' THEN
        v_off_duty_minutes := v_off_duty_minutes + v_log.duration;
      WHEN 'sleeper_berth' THEN
        v_sleeper_minutes := v_sleeper_minutes + v_log.duration;
    END CASE;
  END LOOP;

  -- Convert to hours
  v_driving_hours := (v_driving_minutes / 60.0)::DECIMAL(10, 2);
  v_on_duty_hours := (v_on_duty_minutes / 60.0)::DECIMAL(10, 2);
  v_off_duty_hours := ((v_off_duty_minutes + v_sleeper_minutes) / 60.0)::DECIMAL(10, 2);

  -- Calculate remaining hours
  v_remaining_driving := GREATEST(0, 11.0 - v_driving_hours);
  v_remaining_on_duty := GREATEST(0, 14.0 - v_on_duty_hours);

  -- Check if break is needed (30 minutes after 8 hours driving)
  IF v_driving_hours >= 8.0 AND v_off_duty_hours < 0.5 THEN
    v_needs_break := true;
    v_violations := array_append(v_violations, 'Break required: 30 minutes off-duty needed after 8 hours driving');
  END IF;

  -- Check for violations
  IF v_driving_hours > 11.0 THEN
    v_violations := array_append(v_violations, 'Exceeded 11-hour driving limit');
  END IF;

  IF v_on_duty_hours > 14.0 THEN
    v_violations := array_append(v_violations, 'Exceeded 14-hour on-duty limit');
  END IF;

  -- Return results
  RETURN QUERY SELECT
    v_remaining_driving,
    v_remaining_on_duty,
    v_needs_break,
    v_violations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_remaining_hos(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_remaining_hos(UUID) TO service_role;



