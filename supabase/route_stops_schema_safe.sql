-- Route Stops Schema (Safe Version)
-- This extends the routes table to support multi-stop routes with detailed stop information
-- Run this in Supabase SQL Editor

-- Step 1: Add depot and timing fields to routes table (if they don't exist)
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS depot_name TEXT,
  ADD COLUMN IF NOT EXISTS depot_address TEXT,
  ADD COLUMN IF NOT EXISTS pre_route_time_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_route_time_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS route_start_time TIME,
  ADD COLUMN IF NOT EXISTS route_departure_time TIME,
  ADD COLUMN IF NOT EXISTS route_complete_time TIME,
  ADD COLUMN IF NOT EXISTS route_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS scenario TEXT DEFAULT 'delivery';

-- Step 2: Create Route Stops table
CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  stop_number INTEGER NOT NULL,
  
  -- Location Information
  location_name TEXT NOT NULL,
  location_id TEXT,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  coordinates JSONB,
  
  -- Stop Details
  stop_type TEXT DEFAULT 'delivery',
  priority TEXT,
  salesman_id TEXT,
  
  -- Timing Information
  arrive_time TIME,
  depart_time TIME,
  service_time_minutes INTEGER,
  travel_time_minutes INTEGER,
  
  -- Time Windows
  time_window_1_open TIME,
  time_window_1_close TIME,
  time_window_2_open TIME,
  time_window_2_close TIME,
  
  -- Quantities
  carts INTEGER DEFAULT 0,
  boxes INTEGER DEFAULT 0,
  pallets INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  quantity_type TEXT DEFAULT 'delivery',
  
  -- Additional Information
  special_instructions TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  actual_arrive_time TIMESTAMP WITH TIME ZONE,
  actual_depart_time TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(route_id, stop_number)
);

-- Step 3: Create indexes (drop first if exists to avoid errors)
DROP INDEX IF EXISTS idx_route_stops_route_id;
DROP INDEX IF EXISTS idx_route_stops_company_id;
DROP INDEX IF EXISTS idx_route_stops_stop_number;

CREATE INDEX idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX idx_route_stops_company_id ON public.route_stops(company_id);
CREATE INDEX idx_route_stops_stop_number ON public.route_stops(route_id, stop_number);

-- Step 4: Enable Row Level Security
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view route stops in their company" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can insert route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can update route stops" ON public.route_stops;
DROP POLICY IF EXISTS "Managers can delete route stops" ON public.route_stops;

-- Step 6: Create RLS Policies
CREATE POLICY "Users can view route stops in their company"
  ON public.route_stops FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert route stops"
  ON public.route_stops FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update route stops"
  ON public.route_stops FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete route stops"
  ON public.route_stops FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Step 7: Create function for updated_at (drop first if exists)
DROP FUNCTION IF EXISTS update_route_stops_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_route_stops_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS update_route_stops_updated_at ON public.route_stops;

CREATE TRIGGER update_route_stops_updated_at 
  BEFORE UPDATE ON public.route_stops
  FOR EACH ROW 
  EXECUTE FUNCTION update_route_stops_updated_at_column();

