-- ============================================================================
-- Enable PostGIS Extension
-- ============================================================================
-- Run this in Supabase SQL Editor to enable PostGIS for geofencing
-- ============================================================================

-- Enable PostGIS extension (required for geography/geometry columns)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is enabled
SELECT PostGIS_version();

-- This enables:
-- - GEOGRAPHY data type for storing geographic coordinates
-- - Spatial functions like ST_MakePoint, ST_Distance, ST_Within, etc.
-- - Geographic indexing for better performance













