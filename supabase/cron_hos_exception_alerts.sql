-- Cron Schedule for HOS Exception Alerts Edge Function
-- This runs the hos-exception-alerts function every 15 minutes

-- Note: Supabase cron jobs are configured via the Supabase Dashboard
-- Go to: Database > Cron Jobs > New Cron Job
-- 
-- Configuration:
-- Name: hos-exception-alerts
-- Schedule: */15 * * * * (every 15 minutes)
-- Command: SELECT net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/hos-exception-alerts',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--   ),
--   body := '{}'::jsonb
-- );
--
-- Alternatively, use pg_cron extension if available:
-- SELECT cron.schedule(
--   'hos-exception-alerts',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/hos-exception-alerts',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- For manual testing, you can call the function directly:
-- SELECT * FROM net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/hos-exception-alerts',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--   ),
--   body := '{}'::jsonb
-- );

-- Instructions:
-- 1. Deploy the Edge Function: supabase/functions/hos-exception-alerts/index.ts
-- 2. Configure the cron job in Supabase Dashboard (Database > Cron Jobs)
-- 3. Set the schedule to: */15 * * * * (every 15 minutes)
-- 4. Ensure TWILIO credentials are set in Edge Function secrets



