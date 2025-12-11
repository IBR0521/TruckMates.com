-- Load Delivery Points Schema (Safe Version)
-- This extends the loads table to support multi-delivery point loads
-- Run this in Supabase SQL Editor

-- Step 1: Add fields to loads table to support multi-delivery (if they don't exist)
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS total_delivery_points INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_reference TEXT,
  ADD COLUMN IF NOT EXISTS requires_split_delivery BOOLEAN DEFAULT false;

-- Step 2: Create Load Delivery Points table
CREATE TABLE IF NOT EXISTS public.load_delivery_points (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  delivery_number INTEGER NOT NULL,
  
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
  
  -- Delivery Details
  delivery_type TEXT DEFAULT 'delivery',
  priority TEXT,
  
  -- Load Quantities for this delivery point
  weight_kg DECIMAL(10, 2),
  weight_lbs DECIMAL(10, 2),
  pieces INTEGER DEFAULT 0,
  pallets INTEGER DEFAULT 0,
  boxes INTEGER DEFAULT 0,
  carts INTEGER DEFAULT 0,
  volume_cubic_meters DECIMAL(10, 2),
  
  -- Delivery Instructions
  delivery_instructions TEXT,
  special_handling TEXT,
  requires_liftgate BOOLEAN DEFAULT false,
  requires_inside_delivery BOOLEAN DEFAULT false,
  requires_appointment BOOLEAN DEFAULT false,
  appointment_time TIMESTAMP WITH TIME ZONE,
  
  -- Timing
  scheduled_delivery_date DATE,
  scheduled_delivery_time TIME,
  time_window_start TIME,
  time_window_end TIME,
  actual_delivery_date DATE,
  actual_delivery_time TIME,
  
  -- Status
  status TEXT DEFAULT 'pending',
  delivery_notes TEXT,
  proof_of_delivery_url TEXT,
  
  -- Additional Information
  reference_number TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(load_id, delivery_number)
);

-- Step 3: Create indexes (drop first if exists to avoid errors)
DROP INDEX IF EXISTS idx_load_delivery_points_load_id;
DROP INDEX IF EXISTS idx_load_delivery_points_company_id;
DROP INDEX IF EXISTS idx_load_delivery_points_delivery_number;
DROP INDEX IF EXISTS idx_load_delivery_points_status;

CREATE INDEX idx_load_delivery_points_load_id ON public.load_delivery_points(load_id);
CREATE INDEX idx_load_delivery_points_company_id ON public.load_delivery_points(company_id);
CREATE INDEX idx_load_delivery_points_delivery_number ON public.load_delivery_points(load_id, delivery_number);
CREATE INDEX idx_load_delivery_points_status ON public.load_delivery_points(status);

-- Step 4: Enable Row Level Security
ALTER TABLE public.load_delivery_points ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view delivery points in their company" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can insert delivery points" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can update delivery points" ON public.load_delivery_points;
DROP POLICY IF EXISTS "Managers can delete delivery points" ON public.load_delivery_points;

-- Step 6: Create RLS Policies
CREATE POLICY "Users can view delivery points in their company"
  ON public.load_delivery_points FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert delivery points"
  ON public.load_delivery_points FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update delivery points"
  ON public.load_delivery_points FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete delivery points"
  ON public.load_delivery_points FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Step 7: Create function for updated_at (drop first if exists)
DROP FUNCTION IF EXISTS update_load_delivery_points_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_load_delivery_points_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS update_load_delivery_points_updated_at ON public.load_delivery_points;

CREATE TRIGGER update_load_delivery_points_updated_at 
  BEFORE UPDATE ON public.load_delivery_points
  FOR EACH ROW 
  EXECUTE FUNCTION update_load_delivery_points_updated_at_column();

