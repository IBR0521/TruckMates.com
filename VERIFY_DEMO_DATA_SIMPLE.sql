-- ============================================================================
-- Quick Demo Data Verification - All Counts in One Query
-- ============================================================================
-- Run this in Supabase SQL Editor to see all data counts at once
-- ============================================================================

WITH demo_company AS (
  SELECT id FROM public.companies 
  WHERE name = 'Demo Logistics Company' 
  ORDER BY created_at DESC 
  LIMIT 1
)
SELECT 
  'Drivers' as data_type,
  COUNT(*) as count
FROM public.drivers, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Trucks' as data_type,
  COUNT(*) as count
FROM public.trucks, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Loads' as data_type,
  COUNT(*) as count
FROM public.loads, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Routes' as data_type,
  COUNT(*) as count
FROM public.routes, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Customers' as data_type,
  COUNT(*) as count
FROM public.customers, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Invoices' as data_type,
  COUNT(*) as count
FROM public.invoices, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'ELD Devices' as data_type,
  COUNT(*) as count
FROM public.eld_devices, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'DVIR Reports' as data_type,
  COUNT(*) as count
FROM public.dvir, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'IFTA Reports' as data_type,
  COUNT(*) as count
FROM public.ifta_reports, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Expenses' as data_type,
  COUNT(*) as count
FROM public.expenses, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Maintenance' as data_type,
  COUNT(*) as count
FROM public.maintenance, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Geofences' as data_type,
  COUNT(*) as count
FROM public.geofences, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Address Book' as data_type,
  COUNT(*) as count
FROM public.address_book, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'Settlements' as data_type,
  COUNT(*) as count
FROM public.settlements, demo_company
WHERE company_id = demo_company.id

UNION ALL

SELECT 
  'BOLs' as data_type,
  COUNT(*) as count
FROM public.bols, demo_company
WHERE company_id = demo_company.id

ORDER BY data_type;

-- ============================================================================
-- Also check the demo company ID and user's company_id
-- ============================================================================
SELECT 
  'Company Info' as info_type,
  c.id::text as company_id,
  c.name as company_name,
  u.id::text as user_id,
  u.email as user_email,
  u.company_id::text as user_company_id,
  CASE 
    WHEN c.id = u.company_id THEN '✅ MATCH' 
    ELSE '❌ MISMATCH' 
  END as match_status
FROM public.companies c
CROSS JOIN (
  SELECT id, email, company_id 
  FROM public.users 
  WHERE email = 'demo@truckmates.com'
  LIMIT 1
) u
WHERE c.name = 'Demo Logistics Company'
ORDER BY c.created_at DESC
LIMIT 1;







