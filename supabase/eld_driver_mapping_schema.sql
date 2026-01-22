-- ELD Driver ID Mapping Schema
-- Maps external ELD provider driver IDs to internal TruckMates driver IDs

CREATE TABLE IF NOT EXISTS public.eld_driver_mappings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE CASCADE NOT NULL,
  provider_driver_id TEXT NOT NULL, -- Driver ID from ELD provider (e.g., KeepTruckin, Samsara)
  internal_driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- 'keeptruckin', 'samsara', 'geotab', 'rand_mcnally', 'truckmates_mobile'
  driver_name TEXT, -- Name from provider (for reference)
  driver_email TEXT, -- Email from provider (for reference)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure one mapping per provider driver ID per device
  UNIQUE(eld_device_id, provider_driver_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_eld_driver_mappings_company_id ON public.eld_driver_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_eld_driver_mappings_device_id ON public.eld_driver_mappings(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_driver_mappings_provider_driver_id ON public.eld_driver_mappings(provider_driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_driver_mappings_internal_driver_id ON public.eld_driver_mappings(internal_driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_driver_mappings_provider ON public.eld_driver_mappings(provider);

-- RLS Policies
ALTER TABLE public.eld_driver_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Individuals can view their own driver mappings." ON public.eld_driver_mappings;
CREATE POLICY "Individuals can view their own driver mappings." ON public.eld_driver_mappings
  FOR SELECT USING (auth.uid() IN ( SELECT users.id FROM public.users WHERE users.company_id = eld_driver_mappings.company_id ));

DROP POLICY IF EXISTS "Individuals can create driver mappings." ON public.eld_driver_mappings;
CREATE POLICY "Individuals can create driver mappings." ON public.eld_driver_mappings
  FOR INSERT WITH CHECK (auth.uid() IN ( SELECT users.id FROM public.users WHERE users.company_id = eld_driver_mappings.company_id ));

DROP POLICY IF EXISTS "Individuals can update their own driver mappings." ON public.eld_driver_mappings;
CREATE POLICY "Individuals can update their own driver mappings." ON public.eld_driver_mappings
  FOR UPDATE USING (auth.uid() IN ( SELECT users.id FROM public.users WHERE users.company_id = eld_driver_mappings.company_id ));

DROP POLICY IF EXISTS "Individuals can delete their own driver mappings." ON public.eld_driver_mappings;
CREATE POLICY "Individuals can delete their own driver mappings." ON public.eld_driver_mappings
  FOR DELETE USING (auth.uid() IN ( SELECT users.id FROM public.users WHERE users.company_id = eld_driver_mappings.company_id ));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_eld_driver_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_eld_driver_mappings_updated_at ON public.eld_driver_mappings;
CREATE TRIGGER trigger_update_eld_driver_mappings_updated_at
  BEFORE UPDATE ON public.eld_driver_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_eld_driver_mappings_updated_at();

