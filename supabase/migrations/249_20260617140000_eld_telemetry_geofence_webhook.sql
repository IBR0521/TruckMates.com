-- Event-driven geofence processing: fire HTTP webhook on each eld_telemetry_points INSERT.
-- Uses pg_net (async) so inserts are not blocked. Target URL + secret live in platform_http_targets
-- (service_role only) and must match ELD_TELEMETRY_WEBHOOK_SECRET on the app host.
--
-- After deploy, configure once per environment (SQL editor / service role):
--   INSERT INTO public.platform_http_targets (target_key, url, secret)
--   VALUES (
--     'eld_telemetry_geofence',
--     'https://<your-app-host>/api/webhooks/eld-telemetry-insert',
--     '<same secret as ELD_TELEMETRY_WEBHOOK_SECRET on Vercel>'
--   );

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.platform_http_targets (
  target_key text PRIMARY KEY,
  url text NOT NULL,
  secret text NOT NULL,
  secret_header text NOT NULL DEFAULT 'X-Eld-Telemetry-Webhook-Secret',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_http_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_http_targets FROM authenticated, anon;
GRANT ALL ON public.platform_http_targets TO service_role;

CREATE OR REPLACE FUNCTION public.notify_eld_telemetry_geofence_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  target record;
  request_id bigint;
BEGIN
  SELECT url, secret, secret_header
  INTO target
  FROM public.platform_http_targets
  WHERE target_key = 'eld_telemetry_geofence'
    AND enabled = true
  LIMIT 1;

  IF target.url IS NULL OR btrim(target.url) = '' OR target.secret IS NULL OR target.secret = '' THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := target.url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      COALESCE(NULLIF(btrim(target.secret_header), ''), 'X-Eld-Telemetry-Webhook-Secret'),
      target.secret
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW)
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eld_telemetry_points_geofence_webhook ON public.eld_telemetry_points;

CREATE TRIGGER eld_telemetry_points_geofence_webhook
  AFTER INSERT ON public.eld_telemetry_points
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_eld_telemetry_geofence_webhook();

COMMENT ON TABLE public.platform_http_targets IS
  'Outbound HTTP targets for DB triggers (pg_net). service_role only. eld_telemetry_geofence → /api/webhooks/eld-telemetry-insert';
