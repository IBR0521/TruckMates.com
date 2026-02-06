-- ============================================================================
-- Enhanced Address Book with PostGIS & Role-Based Categorization
-- ============================================================================
-- This migration enhances the address book with:
-- 1. PostGIS geography column for verified coordinates
-- 2. Role-based categorization (Shipper, Receiver, Vendor, Broker, Driver)
-- 3. Custom fields based on category
-- 4. Integration with geofencing
-- ============================================================================

-- Create enhanced address_book table
CREATE TABLE IF NOT EXISTS public.address_book (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Basic Information
  name TEXT NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  fax TEXT,
  
  -- Address Information
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT DEFAULT 'USA',
  
  -- PostGIS Geography (verified coordinates from geocoding)
  coordinates GEOGRAPHY(POINT, 4326), -- Verified lat/lng from Google Maps
  geocoded_at TIMESTAMP WITH TIME ZONE, -- When coordinates were verified
  geocoding_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'failed', 'manual'
  formatted_address TEXT, -- Full formatted address from geocoding service
  place_id TEXT, -- Google Maps Place ID for future reference
  
  -- Role-Based Categorization
  category TEXT NOT NULL CHECK (category IN ('shipper', 'receiver', 'vendor', 'broker', 'driver', 'warehouse', 'repair_shop', 'fuel_station', 'other')),
  
  -- Custom Fields (JSONB for flexibility)
  custom_fields JSONB DEFAULT '{}'::jsonb,
  -- Example custom_fields structure:
  -- {
  --   "gate_code": "1234#",
  --   "warehouse_hours": "Mon-Fri 8AM-5PM",
  --   "accepts_flatbed_after_3pm": true,
  --   "mc_number": "MC123456",
  --   "dock_count": 10,
  --   "loading_instructions": "Use dock 3-5 only",
  --   "contact_preference": "email",
  --   "special_equipment_required": ["flatbed", "hazmat"]
  -- }
  
  -- Operational Details
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false, -- Manually verified by dispatcher
  
  -- Geofencing Integration
  auto_create_geofence BOOLEAN DEFAULT false,
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
  geofence_radius_meters INTEGER DEFAULT 500, -- Default 500m radius for auto-created geofences
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE, -- Track when address was last used in a load/route
  usage_count INTEGER DEFAULT 0 -- Track how many times this address has been used
);

-- Create GIST index for PostGIS geography column (for spatial queries)
CREATE INDEX IF NOT EXISTS idx_address_book_coordinates ON public.address_book USING GIST (coordinates);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_address_book_company_id ON public.address_book(company_id);
CREATE INDEX IF NOT EXISTS idx_address_book_category ON public.address_book(category);
CREATE INDEX IF NOT EXISTS idx_address_book_city_state ON public.address_book(city, state);
CREATE INDEX IF NOT EXISTS idx_address_book_is_active ON public.address_book(is_active);
CREATE INDEX IF NOT EXISTS idx_address_book_geocoding_status ON public.address_book(geocoding_status);

-- Full-text search index for name and company_name
CREATE INDEX IF NOT EXISTS idx_address_book_search ON public.address_book USING GIN (
  to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(company_name, '') || ' ' || COALESCE(city, '') || ' ' || COALESCE(state, ''))
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_address_book_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_address_book_updated_at ON public.address_book;
CREATE TRIGGER trigger_update_address_book_updated_at
  BEFORE UPDATE ON public.address_book
  FOR EACH ROW
  EXECUTE FUNCTION update_address_book_updated_at();

-- Function to automatically create geofence when address is verified
CREATE OR REPLACE FUNCTION auto_create_address_geofence()
RETURNS TRIGGER AS $$
DECLARE
  v_geofence_id UUID;
BEGIN
  -- Only create geofence if coordinates are verified and auto_create_geofence is true
  IF NEW.coordinates IS NOT NULL 
     AND NEW.geocoding_status = 'verified' 
     AND NEW.auto_create_geofence = true 
     AND NEW.geofence_id IS NULL THEN
    
    -- Extract lat/lng from geography point
    DECLARE
      v_lat DECIMAL;
      v_lng DECIMAL;
    BEGIN
      v_lat := ST_Y(NEW.coordinates::geometry);
      v_lng := ST_X(NEW.coordinates::geometry);
      
      -- Create geofence
      INSERT INTO public.geofences (
        company_id,
        name,
        description,
        zone_type,
        center_latitude,
        center_longitude,
        radius_meters,
        address,
        city,
        state,
        zip_code,
        is_active,
        alert_on_entry,
        alert_on_exit
      ) VALUES (
        NEW.company_id,
        COALESCE(NEW.company_name, NEW.name) || ' - Address Book Entry',
        'Auto-created from Address Book entry: ' || NEW.name,
        'circle',
        v_lat,
        v_lng,
        NEW.geofence_radius_meters,
        NEW.address_line1,
        NEW.city,
        NEW.state,
        NEW.zip_code,
        true,
        true,
        true
      ) RETURNING id INTO v_geofence_id;
      
      -- Link geofence to address book entry
      NEW.geofence_id := v_geofence_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create geofence
DROP TRIGGER IF EXISTS trigger_auto_create_address_geofence ON public.address_book;
CREATE TRIGGER trigger_auto_create_address_geofence
  BEFORE INSERT OR UPDATE ON public.address_book
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_address_geofence();

-- Function to find nearby address book entries (using PostGIS)
CREATE OR REPLACE FUNCTION find_nearby_addresses(
  p_company_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_radius_km DECIMAL DEFAULT 10.0,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  company_name TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  category TEXT,
  distance_km DECIMAL,
  coordinates GEOGRAPHY
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ab.id,
    ab.name,
    ab.company_name,
    ab.address_line1,
    ab.city,
    ab.state,
    ab.zip_code,
    ab.category,
    ST_Distance(
      ab.coordinates,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY
    ) / 1000.0 AS distance_km, -- Convert meters to km
    ab.coordinates
  FROM public.address_book ab
  WHERE ab.company_id = p_company_id
    AND ab.is_active = true
    AND ab.coordinates IS NOT NULL
    AND ab.geocoding_status = 'verified'
    AND (p_category IS NULL OR ab.category = p_category)
    AND ST_DWithin(
      ab.coordinates,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY,
      p_radius_km * 1000 -- Convert km to meters
    )
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage count when address is used
CREATE OR REPLACE FUNCTION increment_address_usage(p_address_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.address_book
  SET 
    usage_count = usage_count + 1,
    last_used_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_address_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to extract lat/lng from PostGIS geography point
CREATE OR REPLACE FUNCTION get_point_coordinates(p_point GEOGRAPHY)
RETURNS TABLE (
  lat DECIMAL,
  lng DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ST_Y(p_point::geometry)::DECIMAL AS lat,
    ST_X(p_point::geometry)::DECIMAL AS lng;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view address book entries from their company
CREATE POLICY "Users can view address book from their company"
  ON public.address_book FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert address book entries for their company
CREATE POLICY "Users can insert address book for their company"
  ON public.address_book FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update address book entries from their company
CREATE POLICY "Users can update address book from their company"
  ON public.address_book FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete address book entries from their company
CREATE POLICY "Users can delete address book from their company"
  ON public.address_book FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE public.address_book IS 'Enhanced address book with PostGIS coordinates, role-based categorization, and custom fields';
COMMENT ON COLUMN public.address_book.coordinates IS 'PostGIS geography point with verified lat/lng from geocoding service';
COMMENT ON COLUMN public.address_book.category IS 'Role-based category: shipper, receiver, vendor, broker, driver, warehouse, repair_shop, fuel_station, other';
COMMENT ON COLUMN public.address_book.custom_fields IS 'JSONB object with category-specific custom fields (gate_code, warehouse_hours, mc_number, etc.)';
COMMENT ON COLUMN public.address_book.geofence_id IS 'Linked geofence (auto-created if auto_create_geofence is true)';

