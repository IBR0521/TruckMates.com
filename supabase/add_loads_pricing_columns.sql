-- Add missing columns to loads table
-- Run this in Supabase SQL Editor if you get errors about missing columns
-- This includes all columns from the extended loads schema

ALTER TABLE public.loads
  -- Load Type
  ADD COLUMN IF NOT EXISTS load_type TEXT DEFAULT 'ftl',
  
  -- Customer Reference
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Detailed Shipper Information
  ADD COLUMN IF NOT EXISTS shipper_name TEXT,
  ADD COLUMN IF NOT EXISTS shipper_address TEXT,
  ADD COLUMN IF NOT EXISTS shipper_city TEXT,
  ADD COLUMN IF NOT EXISTS shipper_state TEXT,
  ADD COLUMN IF NOT EXISTS shipper_zip TEXT,
  ADD COLUMN IF NOT EXISTS shipper_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS shipper_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS shipper_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS pickup_time TIME,
  ADD COLUMN IF NOT EXISTS pickup_time_window_start TIME,
  ADD COLUMN IF NOT EXISTS pickup_time_window_end TIME,
  ADD COLUMN IF NOT EXISTS pickup_instructions TEXT,
  
  -- Detailed Consignee Information
  ADD COLUMN IF NOT EXISTS consignee_name TEXT,
  ADD COLUMN IF NOT EXISTS consignee_address TEXT,
  ADD COLUMN IF NOT EXISTS consignee_city TEXT,
  ADD COLUMN IF NOT EXISTS consignee_state TEXT,
  ADD COLUMN IF NOT EXISTS consignee_zip TEXT,
  ADD COLUMN IF NOT EXISTS consignee_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS consignee_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS consignee_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS delivery_time TIME,
  ADD COLUMN IF NOT EXISTS delivery_time_window_start TIME,
  ADD COLUMN IF NOT EXISTS delivery_time_window_end TIME,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
  
  -- Enhanced Freight Details
  ADD COLUMN IF NOT EXISTS pieces INTEGER,
  ADD COLUMN IF NOT EXISTS pallets INTEGER,
  ADD COLUMN IF NOT EXISTS boxes INTEGER,
  ADD COLUMN IF NOT EXISTS length DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS width DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS height DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS temperature DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS is_hazardous BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_oversized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  
  -- Special Requirements
  ADD COLUMN IF NOT EXISTS requires_liftgate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_inside_delivery BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_appointment BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_time TIMESTAMP WITH TIME ZONE,
  
  -- Pricing & Financial
  ADD COLUMN IF NOT EXISTS rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS rate_type TEXT,
  ADD COLUMN IF NOT EXISTS fuel_surcharge DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accessorial_charges DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS estimated_miles INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_profit DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS estimated_revenue DECIMAL(10, 2),
  
  -- BOL Information
  ADD COLUMN IF NOT EXISTS bol_number TEXT,
  
  -- Additional Notes
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_loads_customer_id ON public.loads(customer_id);
CREATE INDEX IF NOT EXISTS idx_loads_load_type ON public.loads(load_type);
CREATE INDEX IF NOT EXISTS idx_loads_bol_number ON public.loads(bol_number);

