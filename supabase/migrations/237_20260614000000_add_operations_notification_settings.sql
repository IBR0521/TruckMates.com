-- Load / dispatch notification settings shown in Operations settings UI

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS notify_on_load_created BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_status_change BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_delivery BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_driver_on_assignment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_delivery_delay BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS required_statuses JSONB NOT NULL DEFAULT '["pending","scheduled","in_transit","delivered"]'::jsonb;

COMMENT ON COLUMN public.company_settings.required_statuses IS
  'Ordered status checkpoints used when allow_status_skip is enabled.';
