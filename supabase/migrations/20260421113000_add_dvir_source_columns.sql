-- Provider-synced DVIR metadata.
ALTER TABLE public.dvir
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_inspection_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dvir_source_check'
      AND conrelid = 'public.dvir'::regclass
  ) THEN
    ALTER TABLE public.dvir
      ADD CONSTRAINT dvir_source_check
      CHECK (source IN ('manual', 'samsara', 'motive'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dvir_source
  ON public.dvir(source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dvir_provider_sync_unique
  ON public.dvir(company_id, source, provider_inspection_id)
  WHERE provider_inspection_id IS NOT NULL;

COMMENT ON COLUMN public.dvir.source IS
  'DVIR origin: manual (internal), samsara, or motive.';

COMMENT ON COLUMN public.dvir.provider_inspection_id IS
  'Provider DVIR/inspection identifier for idempotent sync upserts.';
