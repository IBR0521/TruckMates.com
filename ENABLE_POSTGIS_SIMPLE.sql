-- ============================================================================
-- Enable PostGIS Extension in Supabase
-- ============================================================================
-- Run this in Supabase SQL Editor to enable PostGIS for geospatial features
-- ============================================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is enabled (this should return version info)
SELECT PostGIS_version();

-- ============================================================================
-- That's it! PostGIS is now enabled.
-- ============================================================================
-- After running this, you can use PostGIS functions like:
-- - ST_MakePoint, ST_SetSRID, ST_DWithin, ST_Distance, etc.
-- - GEOGRAPHY data type for storing geographic coordinates
-- ============================================================================














