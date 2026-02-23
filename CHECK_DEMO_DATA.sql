-- Quick check: Verify demo data exists in your database
-- Run this in Supabase SQL Editor to see if demo data was populated

-- Replace 'YOUR_COMPANY_ID' with your actual demo company ID
-- You can find it by running: SELECT id, name FROM public.companies WHERE name = 'Demo Logistics Company';

-- Check drivers
SELECT COUNT(*) as driver_count FROM public.drivers WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' LIMIT 1
);

-- Check trucks
SELECT COUNT(*) as truck_count FROM public.trucks WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' LIMIT 1
);

-- Check loads
SELECT COUNT(*) as load_count FROM public.loads WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' LIMIT 1
);

-- Check invoices
SELECT COUNT(*) as invoice_count FROM public.invoices WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' LIMIT 1
);

-- Check customers
SELECT COUNT(*) as customer_count FROM public.customers WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' LIMIT 1
);

-- Check routes
SELECT COUNT(*) as route_count FROM public.routes WHERE company_id = (
  SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' LIMIT 1
);

-- Get company ID for reference
SELECT id, name, created_at FROM public.companies WHERE name = 'Demo Logistics Company';

