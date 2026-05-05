-- ============================================================================
-- Simple Check for GIST Indexes
-- Run this to verify GIST indexes exist
-- ============================================================================

-- Check if PostGIS is enabled
SELECT 
  'PostGIS Extension' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') 
    THEN '✅ Enabled' 
    ELSE '❌ Not Enabled' 
  END as status;

-- Check GIST indexes on eld_locations (Fleet Map)
SELECT 
  'Fleet Map Indexes' as check_type,
  indexname,
  '✅ GIST Index Found' as status
FROM pg_indexes
WHERE tablename = 'eld_locations' 
  AND indexdef LIKE '%GIST%'
ORDER BY indexname;

-- Check GIST indexes on geofences (Zones)
SELECT 
  'Zones Indexes' as check_type,
  indexname,
  '✅ GIST Index Found' as status
FROM pg_indexes
WHERE tablename = 'geofences' 
  AND indexdef LIKE '%GIST%'
ORDER BY indexname;

-- Check if geography columns have data
SELECT 
  'eld_locations' as table_name,
  COUNT(*) as total_rows,
  COUNT(location_geography) as rows_with_postgis,
  CASE 
    WHEN COUNT(location_geography) > 0 THEN '✅ Has PostGIS Data'
    ELSE '⚠️ No PostGIS Data Yet'
  END as status
FROM public.eld_locations;

SELECT 
  'geofences' as table_name,
  COUNT(*) as total_rows,
  COUNT(center_geography) + COUNT(polygon_geography) as rows_with_postgis,
  CASE 
    WHEN COUNT(center_geography) + COUNT(polygon_geography) > 0 THEN '✅ Has PostGIS Data'
    ELSE '⚠️ No PostGIS Data Yet'
  END as status
FROM public.geofences;



