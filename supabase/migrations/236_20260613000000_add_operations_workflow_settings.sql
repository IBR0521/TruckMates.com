-- Operations workflow settings (load + dispatch settings UI)

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS require_bol_before_dispatch BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_documents_before_dispatch BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assign_driver BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assign_truck BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_status_skip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assignment_priority TEXT DEFAULT 'proximity',
  ADD COLUMN IF NOT EXISTS consider_driver_hours BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consider_truck_maintenance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_distance_for_auto_assign INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS default_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lbs',
  ADD COLUMN IF NOT EXISTS distance_unit TEXT DEFAULT 'miles',
  ADD COLUMN IF NOT EXISTS temperature_unit TEXT DEFAULT 'fahrenheit',
  ADD COLUMN IF NOT EXISTS require_confirmation_before_dispatch BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatch_approval_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_dispatch_on_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_bulk_dispatch BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.company_settings.require_bol_before_dispatch IS
  'When true, loads cannot move to scheduled/in_transit without a linked BOL.';
COMMENT ON COLUMN public.company_settings.require_documents_before_dispatch IS
  'When true, loads cannot dispatch until required_documents types are attached.';
