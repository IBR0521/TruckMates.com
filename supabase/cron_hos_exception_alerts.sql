-- ============================================================================
-- HOS Exception Alerts Function
-- ============================================================================
-- This function checks all active drivers for HOS violations and creates alerts
-- Can be called manually or scheduled via Supabase Cron Jobs
-- ============================================================================

-- Function to check HOS exceptions for all active drivers
CREATE OR REPLACE FUNCTION public.check_hos_exceptions()
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  company_id UUID,
  alert_type TEXT,
  message TEXT,
  hours_remaining DECIMAL(10, 2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_hos_data RECORD;
  v_alerts_count INTEGER := 0;
BEGIN
  -- Loop through all active drivers
  FOR v_driver IN
    SELECT d.id, d.name, d.company_id
    FROM public.drivers d
    WHERE d.status = 'active'
  LOOP
    -- Calculate remaining HOS for this driver
    SELECT * INTO v_hos_data
    FROM public.calculate_remaining_hos(v_driver.id)
    LIMIT 1;

    -- Skip if no HOS data found
    IF v_hos_data IS NULL THEN
      CONTINUE;
    END IF;

    -- Alert 1: Approaching 11-hour driving limit (< 2 hours remaining)
    IF v_hos_data.remaining_driving < 2 AND v_hos_data.remaining_driving > 0 THEN
      RETURN QUERY SELECT
        v_driver.id,
        v_driver.name,
        v_driver.company_id,
        'approaching_limit'::TEXT,
        format('%s has %.1f hours of driving time remaining. Plan break soon.', 
                v_driver.name, v_hos_data.remaining_driving)::TEXT,
        v_hos_data.remaining_driving;
      v_alerts_count := v_alerts_count + 1;
    END IF;

    -- Alert 2: Break required (30-minute break needed after 8 hours)
    IF v_hos_data.needs_break THEN
      RETURN QUERY SELECT
        v_driver.id,
        v_driver.name,
        v_driver.company_id,
        'break_required'::TEXT,
        format('%s needs a 30-minute break (has driven 8+ hours).', 
                v_driver.name)::TEXT,
        NULL::DECIMAL(10, 2);
      v_alerts_count := v_alerts_count + 1;
    END IF;

    -- Alert 3: Driving limit reached (0 hours remaining)
    IF v_hos_data.remaining_driving <= 0 THEN
      RETURN QUERY SELECT
        v_driver.id,
        v_driver.name,
        v_driver.company_id,
        'limit_reached'::TEXT,
        format('%s has reached the 11-hour driving limit. Must take 10-hour break.', 
                v_driver.name)::TEXT,
        0::DECIMAL(10, 2);
      v_alerts_count := v_alerts_count + 1;
    END IF;

    -- Alert 4: On-duty limit approaching (< 1 hour remaining)
    IF v_hos_data.remaining_on_duty < 1 AND v_hos_data.remaining_on_duty > 0 THEN
      RETURN QUERY SELECT
        v_driver.id,
        v_driver.name,
        v_driver.company_id,
        'approaching_limit'::TEXT,
        format('%s has %.1f hours of on-duty time remaining.', 
                v_driver.name, v_hos_data.remaining_on_duty)::TEXT,
        v_hos_data.remaining_on_duty;
      v_alerts_count := v_alerts_count + 1;
    END IF;

    -- Alert 5: On-duty limit reached
    IF v_hos_data.remaining_on_duty <= 0 THEN
      RETURN QUERY SELECT
        v_driver.id,
        v_driver.name,
        v_driver.company_id,
        'limit_reached'::TEXT,
        format('%s has reached the 14-hour on-duty limit. Must take 10-hour break.', 
                v_driver.name)::TEXT,
        0::DECIMAL(10, 2);
      v_alerts_count := v_alerts_count + 1;
    END IF;
  END LOOP;

  -- Log summary (optional - can be removed if not needed)
  RAISE NOTICE 'Checked HOS exceptions: % alerts found', v_alerts_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_hos_exceptions() TO authenticated;

-- Function to create notifications from HOS exceptions
CREATE OR REPLACE FUNCTION public.create_hos_exception_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert RECORD;
  v_notifications_created INTEGER := 0;
BEGIN
  -- Get all HOS exceptions
  FOR v_alert IN
    SELECT * FROM public.check_hos_exceptions()
  LOOP
    -- Create notification for manager users in the company
    INSERT INTO public.notifications (
      user_id,
      company_id,
      type,
      title,
      message,
      priority,
      metadata
    )
    SELECT
      u.id,
      v_alert.company_id,
      'alert',
      'HOS Exception Alert',
      v_alert.message,
      CASE 
        WHEN v_alert.alert_type = 'limit_reached' THEN 'critical'
        WHEN v_alert.alert_type = 'break_required' THEN 'high'
        ELSE 'normal'
      END,
      jsonb_build_object(
        'driver_id', v_alert.driver_id,
        'driver_name', v_alert.driver_name,
        'alert_type', v_alert.alert_type,
        'hours_remaining', v_alert.hours_remaining
      )
    FROM public.users u
    WHERE u.company_id = v_alert.company_id
      AND u.role = 'manager'
      AND u.id NOT IN (
        -- Avoid duplicate notifications (check if similar notification exists in last hour)
        SELECT user_id
        FROM public.notifications
        WHERE company_id = v_alert.company_id
          AND type = 'alert'
          AND metadata->>'driver_id' = v_alert.driver_id::TEXT
          AND metadata->>'alert_type' = v_alert.alert_type
          AND created_at > NOW() - INTERVAL '1 hour'
      );

    GET DIAGNOSTICS v_notifications_created = ROW_COUNT;
  END LOOP;

  RETURN v_notifications_created;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_hos_exception_notifications() TO authenticated;

-- ============================================================================
-- CRON JOB SETUP INSTRUCTIONS
-- ============================================================================
-- 
-- Option 1: Supabase Dashboard (Recommended)
-- 1. Go to: Database > Cron Jobs > New Cron Job
-- 2. Name: hos-exception-alerts
-- 3. Schedule: */15 * * * * (every 15 minutes)
-- 4. Command: SELECT public.create_hos_exception_notifications();
-- 
-- Option 2: Edge Function (if you prefer using Edge Functions)
-- 1. Deploy: supabase/functions/hos-exception-alerts/index.ts
-- 2. Configure cron job to call Edge Function URL
-- 3. Edge Function will call check_hos_exceptions() internally
-- 
-- Option 3: Manual Testing
-- Run: SELECT * FROM public.check_hos_exceptions();
-- Or: SELECT public.create_hos_exception_notifications();
-- 
-- ============================================================================



