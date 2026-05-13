-- Phase B-4: AI-enriched smart notifications (scoring, clustering, proactive alerts)

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS ai_priority text CHECK (
    ai_priority IN ('critical', 'high', 'medium', 'low')
  ),
  ADD COLUMN IF NOT EXISTS ai_cluster_id uuid,
  ADD COLUMN IF NOT EXISTS ai_reasoning text,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'event' CHECK (
    source IN ('event', 'ai_proactive', 'ai_cluster_parent')
  );

CREATE INDEX IF NOT EXISTS idx_notifications_ai_priority
  ON notifications(company_id, ai_priority, created_at DESC)
  WHERE ai_suppressed = false;

CREATE INDEX IF NOT EXISTS idx_notifications_cluster
  ON notifications(ai_cluster_id)
  WHERE ai_cluster_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_proactive_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  alert_key text NOT NULL,
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- At most one unresolved row per (company, type, key); resolved rows may repeat after cleanup.
CREATE UNIQUE INDEX IF NOT EXISTS ai_proactive_alerts_open_dedupe
  ON ai_proactive_alerts (company_id, alert_type, alert_key)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_ai_proactive_alerts_company_active
  ON ai_proactive_alerts(company_id, resolved, created_at DESC);

ALTER TABLE ai_proactive_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_proactive_alerts_company_select ON ai_proactive_alerts;
CREATE POLICY ai_proactive_alerts_company_select
  ON ai_proactive_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()
            AND u.company_id = ai_proactive_alerts.company_id)
  );

DROP POLICY IF EXISTS ai_proactive_alerts_service_role_all ON ai_proactive_alerts;
CREATE POLICY ai_proactive_alerts_service_role_all
  ON ai_proactive_alerts FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_smart_mode boolean NOT NULL DEFAULT true;

-- Throttle per-company cron work (skip if last run within 10 minutes)
CREATE TABLE IF NOT EXISTS ai_smart_notification_cron_state (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  last_run_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_smart_notification_cron_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_smart_notification_cron_state_service_all ON ai_smart_notification_cron_state;
CREATE POLICY ai_smart_notification_cron_state_service_all
  ON ai_smart_notification_cron_state FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
