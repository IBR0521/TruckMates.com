-- Performance: add company_id composite indexes on the hottest tenant-scoped tables.
--
-- Postgres does NOT auto-index foreign-key columns, so a `company_id uuid REFERENCES companies` column
-- is unindexed unless declared. Many tables already have one (customers, bols, vendors, sms_logs, …),
-- but these high-traffic core tables did not — every RLS-filtered query on them (nearly all queries)
-- and the plan-enforcement counts scanned more than necessary. `ai_usage_logs` is the sharpest: it is
-- counted on EVERY callClaude() to enforce the monthly AI cap.
--
-- Columns below are matched to the actual query shapes:
--   • (company_id, created_at) → monthly-usage counts + recency-ordered lists / dedup windows
--   • (company_id, status)     → resource-limit counts + status-filtered lists
--
-- NOTE for large production tables: plain CREATE INDEX briefly locks writes while it builds. These use
-- IF NOT EXISTS so re-runs are no-ops. If any of these tables is already large, apply the equivalent
-- `CREATE INDEX CONCURRENTLY` manually (it cannot run inside a migration transaction) during low traffic.

-- Counted on every AI call (checkMonthlyUsage "ai_calls").
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_company_created
  ON public.ai_usage_logs (company_id, created_at);

-- Core dispatch table: monthly load cap + status-filtered dashboards/lists.
CREATE INDEX IF NOT EXISTS idx_loads_company_created
  ON public.loads (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loads_company_status
  ON public.loads (company_id, status);

-- Notification center + agent dedup windows (company_id + created_at range).
CREATE INDEX IF NOT EXISTS idx_notifications_company_created
  ON public.notifications (company_id, created_at);

-- Resource-limit counts (checkResourceLimit trucks/drivers) + fleet lists.
CREATE INDEX IF NOT EXISTS idx_trucks_company_status
  ON public.trucks (company_id, status);
CREATE INDEX IF NOT EXISTS idx_drivers_company_status
  ON public.drivers (company_id, status);

-- Invoice lists + overdue scan (company_id + status).
CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON public.invoices (company_id, status);

-- Settlement lists / payroll.
CREATE INDEX IF NOT EXISTS idx_settlements_company_id
  ON public.settlements (company_id);
