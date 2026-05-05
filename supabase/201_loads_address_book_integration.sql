-- ============================================================================
-- Loads Address Book Integration
-- ============================================================================
-- This migration adds address book integration to loads table
-- Links loads to address book entries for shipper and consignee
-- ============================================================================

-- Add address book foreign keys to loads table
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS shipper_address_book_id UUID REFERENCES public.address_book(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consignee_address_book_id UUID REFERENCES public.address_book(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_loads_shipper_address_book_id ON public.loads(shipper_address_book_id);
CREATE INDEX IF NOT EXISTS idx_loads_consignee_address_book_id ON public.loads(consignee_address_book_id);

-- Add PostGIS coordinates columns if they don't exist (for route optimization)
-- These will store verified coordinates from address book
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS shipper_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS shipper_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS consignee_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS consignee_longitude DECIMAL(11, 8);

-- Create indexes for coordinate lookups
CREATE INDEX IF NOT EXISTS idx_loads_shipper_coords ON public.loads(shipper_latitude, shipper_longitude);
CREATE INDEX IF NOT EXISTS idx_loads_consignee_coords ON public.loads(consignee_latitude, consignee_longitude);

-- Function to automatically populate coordinates from address book
CREATE OR REPLACE FUNCTION update_load_coordinates_from_address_book()
RETURNS TRIGGER AS $$
BEGIN
  -- Update shipper coordinates if address book entry is linked
  IF NEW.shipper_address_book_id IS NOT NULL THEN
    SELECT 
      ST_Y(coordinates::geometry)::DECIMAL(10, 8),
      ST_X(coordinates::geometry)::DECIMAL(11, 8)
    INTO NEW.shipper_latitude, NEW.shipper_longitude
    FROM public.address_book
    WHERE id = NEW.shipper_address_book_id
      AND coordinates IS NOT NULL
      AND geocoding_status = 'verified';
  END IF;

  -- Update consignee coordinates if address book entry is linked
  IF NEW.consignee_address_book_id IS NOT NULL THEN
    SELECT 
      ST_Y(coordinates::geometry)::DECIMAL(10, 8),
      ST_X(coordinates::geometry)::DECIMAL(11, 8)
    INTO NEW.consignee_latitude, NEW.consignee_longitude
    FROM public.address_book
    WHERE id = NEW.consignee_address_book_id
      AND coordinates IS NOT NULL
      AND geocoding_status = 'verified';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update coordinates
DROP TRIGGER IF EXISTS trigger_update_load_coordinates ON public.loads;
CREATE TRIGGER trigger_update_load_coordinates
  BEFORE INSERT OR UPDATE ON public.loads
  FOR EACH ROW
  EXECUTE FUNCTION update_load_coordinates_from_address_book();



