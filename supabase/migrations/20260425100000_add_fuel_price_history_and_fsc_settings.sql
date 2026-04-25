-- Fuel surcharge automation: weekly DOE/EIA diesel history + FSC baseline settings.

CREATE TABLE IF NOT EXISTS public.fuel_price_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'eia',
  series_id TEXT NOT NULL DEFAULT 'EPD2D',
  period TEXT,
  effective_date DATE NOT NULL,
  price_per_gallon NUMERIC(10, 4) NOT NULL CHECK (price_per_gallon >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (source, series_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_fuel_price_history_effective_date
  ON public.fuel_price_history (effective_date DESC);

ALTER TABLE public.fuel_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view fuel price history" ON public.fuel_price_history;
CREATE POLICY "Authenticated users can view fuel price history"
  ON public.fuel_price_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS fsc_base_price NUMERIC(10, 4) DEFAULT 1.20,
  ADD COLUMN IF NOT EXISTS fsc_mpg_assumed NUMERIC(10, 4) DEFAULT 6.50;
