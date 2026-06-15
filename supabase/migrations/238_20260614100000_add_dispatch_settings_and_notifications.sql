-- Dispatch settings UI fields + notification toggles (Settings → Dispatch)

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS require_check_call_at_milestones BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_call_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS auto_escalate_missed_calls BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS driver_assignment_method TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS consider_driver_proximity BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consider_driver_experience BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_assignment_distance INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS preferred_driver_priority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_optimize_routes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_optimization_algorithm TEXT DEFAULT 'distance',
  ADD COLUMN IF NOT EXISTS consider_traffic BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consider_tolls BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_route_deviations BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_route_deviation_miles INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notify_on_dispatch BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_check_call_missed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_driver_late BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_route_deviation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_channels JSONB NOT NULL DEFAULT '["email","in_app"]'::jsonb,
  ADD COLUMN IF NOT EXISTS track_driver_location BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_update_interval INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geofence_radius INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS emergency_contact_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_notify_on_emergency BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS emergency_escalation_minutes INTEGER DEFAULT 15;

COMMENT ON COLUMN public.company_settings.notify_on_dispatch IS
  'Notify dispatchers when a load is first scheduled or sent in transit.';
COMMENT ON COLUMN public.company_settings.notify_on_check_call_missed IS
  'Notify dispatchers when a scheduled check call is missed.';
COMMENT ON COLUMN public.company_settings.notify_on_driver_late IS
  'Notify dispatchers when a driver has not departed by the pickup appointment.';
COMMENT ON COLUMN public.company_settings.notify_on_route_deviation IS
  'Notify dispatchers when an active route exceeds the configured deviation threshold.';
