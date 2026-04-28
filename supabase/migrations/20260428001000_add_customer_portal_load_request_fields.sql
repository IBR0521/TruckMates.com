ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS requested_via_portal BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_request_status TEXT,
  ADD COLUMN IF NOT EXISTS portal_request_message TEXT,
  ADD COLUMN IF NOT EXISTS requested_equipment_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loads_portal_request_status_check'
  ) THEN
    ALTER TABLE public.loads
      ADD CONSTRAINT loads_portal_request_status_check
      CHECK (
        portal_request_status IS NULL OR portal_request_status IN ('pending', 'accepted', 'rejected')
      );
  END IF;
END $$;
