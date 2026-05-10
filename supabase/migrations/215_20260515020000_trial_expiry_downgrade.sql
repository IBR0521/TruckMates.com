-- Expired trials → Owner-Operator tier (keeps users in the product; no full lockout).
-- Invoke manually or on a schedule:
--   SELECT public.apply_expired_trial_downgrades();
--
-- When pg_cron is enabled, this migration registers an hourly job (minute 15 UTC).

CREATE OR REPLACE FUNCTION public.apply_expired_trial_downgrades()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.companies
  SET
    subscription_tier = 'owner_operator',
    subscription_status = 'expired'
  WHERE subscription_status = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < timezone('utc', now());

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.apply_expired_trial_downgrades() IS
  'Downgrades companies past trial_ends_at from trial to owner_operator / expired. Safe to run repeatedly.';

REVOKE ALL ON FUNCTION public.apply_expired_trial_downgrades() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_expired_trial_downgrades() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('truckmates_expire_trials');
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    PERFORM cron.schedule(
      'truckmates_expire_trials',
      '15 * * * *',
      'SELECT public.apply_expired_trial_downgrades();'
    );
  END IF;
END
$cron$;
