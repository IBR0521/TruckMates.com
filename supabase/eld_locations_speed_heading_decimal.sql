-- Migration: Change speed and heading columns from INTEGER to DECIMAL
-- This fixes precision loss for speed (e.g., 67.3 MPH) and heading (e.g., 45.7 degrees)
-- Run this if eld_locations table already exists with INTEGER columns

-- Check if columns exist and are INTEGER type, then alter to DECIMAL
DO $$
BEGIN
  -- Check if speed column exists and is INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'eld_locations' 
    AND column_name = 'speed'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.eld_locations 
      ALTER COLUMN speed TYPE DECIMAL(6, 1) USING speed::DECIMAL(6, 1);
    
    COMMENT ON COLUMN public.eld_locations.speed IS 
      'Speed in MPH (decimal for precision, e.g., 67.3 MPH)';
  END IF;

  -- Check if heading column exists and is INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'eld_locations' 
    AND column_name = 'heading'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.eld_locations 
      ALTER COLUMN heading TYPE DECIMAL(5, 1) USING heading::DECIMAL(5, 1);
    
    COMMENT ON COLUMN public.eld_locations.heading IS 
      'Heading in degrees 0-360 (decimal for precision, e.g., 45.7 degrees)';
  END IF;
END $$;

