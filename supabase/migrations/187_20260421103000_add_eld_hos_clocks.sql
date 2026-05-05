-- Live HOS clocks synced from ELD providers (Samsara, Motive).
CREATE TABLE IF NOT EXISTS public.eld_hos_clocks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  remaining_drive_ms BIGINT,
  remaining_shift_ms BIGINT,
  remaining_cycle_ms BIGINT,
  cycle_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  raw_data JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eld_hos_clocks_device_driver_unique
  ON public.eld_hos_clocks(eld_device_id, driver_id);

CREATE INDEX IF NOT EXISTS idx_eld_hos_clocks_company_id
  ON public.eld_hos_clocks(company_id);

CREATE INDEX IF NOT EXISTS idx_eld_hos_clocks_driver_id
  ON public.eld_hos_clocks(driver_id);

CREATE INDEX IF NOT EXISTS idx_eld_hos_clocks_updated_at
  ON public.eld_hos_clocks(updated_at DESC);

ALTER TABLE public.eld_hos_clocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view ELD HOS clocks in their company" ON public.eld_hos_clocks;
CREATE POLICY "Users can view ELD HOS clocks in their company"
  ON public.eld_hos_clocks FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert ELD HOS clocks" ON public.eld_hos_clocks;
CREATE POLICY "System can insert ELD HOS clocks"
  ON public.eld_hos_clocks FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can update ELD HOS clocks" ON public.eld_hos_clocks;
CREATE POLICY "System can update ELD HOS clocks"
  ON public.eld_hos_clocks FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE public.eld_hos_clocks IS
  'Latest provider HOS clocks by driver for live remaining drive/shift/cycle time.';
