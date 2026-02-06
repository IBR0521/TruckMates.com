-- ============================================================================
-- Verify PostGIS GIST Indexes
-- Run this to check if GIST indexes are created and being used
-- ============================================================================

-- Check if PostGIS extension is enabled
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname = 'postgis';

-- Check GIST indexes on eld_locations (for Fleet Map)
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'eld_locations' 
  AND indexdef LIKE '%GIST%'
ORDER BY indexname;

-- Check GIST indexes on geofences (for Zones)
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'geofences' 
  AND indexdef LIKE '%GIST%'
ORDER BY indexname;

-- Check if geography columns exist and have data
SELECT 
  'eld_locations' as table_name,
  COUNT(*) as total_rows,
  COUNT(location_geography) as rows_with_geography,
  COUNT(*) - COUNT(location_geography) as rows_without_geography
FROM public.eld_locations
UNION ALL
SELECT 
  'geofences' as table_name,
  COUNT(*) as total_rows,
  COUNT(center_geography) + COUNT(polygon_geography) as rows_with_geography,
  COUNT(*) - (COUNT(center_geography) + COUNT(polygon_geography)) as rows_without_geography
FROM public.geofences;

-- Check index usage statistics (if available)
SELECT 
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE relname IN ('eld_locations', 'geofences')
  AND indexrelname LIKE '%geography%'
ORDER BY idx_scan DESC;

-- Test if GIST index is being used (example query)
EXPLAIN ANALYZE
SELECT 
  id,
  latitude,
  longitude,
  timestamp
FROM public.eld_locations
WHERE location_geography IS NOT NULL
  AND ST_DWithin(
    location_geography,
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
    1000
  )
LIMIT 10;

