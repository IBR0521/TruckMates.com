-- ============================================================================
-- IFTA Trip Sheets (manual entry — no ELD required)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trip_sheets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  odometer_start NUMERIC(12, 1),
  odometer_end NUMERIC(12, 1),
  origin_state TEXT,
  destination_state TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_sheets_company_id ON public.trip_sheets(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_sheets_trip_date ON public.trip_sheets(trip_date);
CREATE INDEX IF NOT EXISTS idx_trip_sheets_truck_id ON public.trip_sheets(truck_id);
CREATE INDEX IF NOT EXISTS idx_trip_sheets_driver_id ON public.trip_sheets(driver_id);

CREATE TABLE IF NOT EXISTS public.trip_sheet_state_miles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_sheet_id UUID NOT NULL REFERENCES public.trip_sheets(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL,
  miles_driven NUMERIC(12, 2) NOT NULL CHECK (miles_driven >= 0),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_sheet_state_miles_sheet ON public.trip_sheet_state_miles(trip_sheet_id);
CREATE INDEX IF NOT EXISTS idx_trip_sheet_state_miles_state ON public.trip_sheet_state_miles(state_code);

CREATE TABLE IF NOT EXISTS public.trip_sheet_fuel_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_sheet_id UUID NOT NULL REFERENCES public.trip_sheets(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL,
  gallons NUMERIC(12, 3) NOT NULL CHECK (gallons >= 0),
  price_per_gallon NUMERIC(10, 4) NOT NULL CHECK (price_per_gallon >= 0),
  total_amount NUMERIC(12, 2),
  city TEXT,
  location_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_sheet_fuel_sheet ON public.trip_sheet_fuel_purchases(trip_sheet_id);

-- RLS
ALTER TABLE public.trip_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_sheet_state_miles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_sheet_fuel_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_sheets_select_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_select_company" ON public.trip_sheets
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
DROP POLICY IF EXISTS "trip_sheets_insert_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_insert_company" ON public.trip_sheets
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
DROP POLICY IF EXISTS "trip_sheets_update_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_update_company" ON public.trip_sheets
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
DROP POLICY IF EXISTS "trip_sheets_delete_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_delete_company" ON public.trip_sheets
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "trip_sheet_state_miles_all" ON public.trip_sheet_state_miles;
CREATE POLICY "trip_sheet_state_miles_all" ON public.trip_sheet_state_miles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.trip_sheets ts
      WHERE ts.id = trip_sheet_id
        AND ts.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_sheets ts
      WHERE ts.id = trip_sheet_id
        AND ts.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "trip_sheet_fuel_all" ON public.trip_sheet_fuel_purchases;
CREATE POLICY "trip_sheet_fuel_all" ON public.trip_sheet_fuel_purchases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.trip_sheets ts
      WHERE ts.id = trip_sheet_id
        AND ts.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_sheets ts
      WHERE ts.id = trip_sheet_id
        AND ts.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_sheet_state_miles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_sheet_fuel_purchases TO authenticated;
