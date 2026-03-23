-- ============================================================================
-- Verify Demo Data Exists
-- ============================================================================
-- Run this in Supabase SQL Editor to check if demo data was created
-- ============================================================================

-- First, get your demo company ID
SELECT 
  id as company_id,
  name as company_name,
  created_at
FROM public.companies 
WHERE name = 'Demo Logistics Company'
ORDER BY created_at DESC
LIMIT 1;

-- Or check all companies:
SELECT id, name, email, created_at FROM public.companies ORDER BY created_at DESC;

-- ============================================================================
-- Check Data Counts for Demo Company
-- ============================================================================
-- This uses a subquery to get the demo company ID automatically

-- Drivers
SELECT 
  'Drivers' as table_name,
  COUNT(*) as count,
  array_agg(name) as names
FROM public.drivers 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Trucks
SELECT 
  'Trucks' as table_name,
  COUNT(*) as count,
  array_agg(truck_number) as truck_numbers
FROM public.trucks 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Loads
SELECT 
  'Loads' as table_name,
  COUNT(*) as count,
  array_agg(shipment_number) as shipment_numbers
FROM public.loads 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Routes
SELECT 
  'Routes' as table_name,
  COUNT(*) as count,
  array_agg(name) as route_names
FROM public.routes 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Customers
SELECT 
  'Customers' as table_name,
  COUNT(*) as count,
  array_agg(name) as customer_names
FROM public.customers 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Invoices
SELECT 
  'Invoices' as table_name,
  COUNT(*) as count,
  array_agg(invoice_number) as invoice_numbers
FROM public.invoices 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- ELD Devices
SELECT 
  'ELD Devices' as table_name,
  COUNT(*) as count,
  array_agg(device_serial_number) as device_serials
FROM public.eld_devices 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- DVIR Reports
SELECT 
  'DVIR Reports' as table_name,
  COUNT(*) as count
FROM public.dvir 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- IFTA Reports
SELECT 
  'IFTA Reports' as table_name,
  COUNT(*) as count,
  array_agg(period) as periods
FROM public.ifta_reports 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Expenses
SELECT 
  'Expenses' as table_name,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.expenses 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Maintenance
SELECT 
  'Maintenance' as table_name,
  COUNT(*) as count
FROM public.maintenance 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Geofences
SELECT 
  'Geofences' as table_name,
  COUNT(*) as count,
  array_agg(name) as geofence_names
FROM public.geofences 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- Address Book
SELECT 
  'Address Book' as table_name,
  COUNT(*) as count,
  array_agg(name) as address_names
FROM public.address_book 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- Check if function exists and can be called
-- ============================================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'populate_demo_data_for_company';

-- ============================================================================
-- Test the function manually for Demo Company
-- ============================================================================
-- Uncomment the line below to manually trigger demo data population:
-- SELECT populate_demo_data_for_company((SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1));

