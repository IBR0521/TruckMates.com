-- ============================================================================
-- COMPREHENSIVE PLATFORM DEMO DATA
-- ============================================================================
-- This script populates the entire platform with realistic demo data
-- Perfect for "View Demo" functionality - makes the platform look fully operational
-- ============================================================================
-- Run this AFTER all schema files have been executed
-- ============================================================================

-- ============================================================================
-- STEP 1: DEMO COMPANY
-- ============================================================================

-- Create or get demo company
-- First, delete any duplicate demo companies (keep only the most recent one)
DO $$
DECLARE
  v_keep_id UUID;
BEGIN
  -- Get the ID of the most recent demo company using subquery to ensure single row
  SELECT id INTO v_keep_id
  FROM (
    SELECT id FROM public.companies
    WHERE name = 'Demo Logistics Co.'
    ORDER BY created_at DESC
    LIMIT 1
  ) subq;
  
  -- Delete all others if multiple exist
  IF v_keep_id IS NOT NULL THEN
    DELETE FROM public.companies
    WHERE name = 'Demo Logistics Co.'
      AND id != v_keep_id;
  END IF;
END $$;

-- Now create or get the single demo company
DO $$
DECLARE
  v_demo_company_id UUID;
BEGIN
  -- Get the demo company using subquery to ensure single row
  SELECT id INTO v_demo_company_id
  FROM (
    SELECT id FROM public.companies
    WHERE name = 'Demo Logistics Co.'
    LIMIT 1
  ) subq;

  -- Create demo company if it doesn't exist
  IF v_demo_company_id IS NULL THEN
    INSERT INTO public.companies (name, address, phone, email)
    VALUES (
      'Demo Logistics Co.',
      '1234 Transportation Blvd, Dallas, TX 75201',
      '(555) 123-4567',
      'demo@logisticsco.com'
    )
    RETURNING id INTO v_demo_company_id;
  END IF;

  -- Store company ID in a temporary table for use in subsequent inserts
  DROP TABLE IF EXISTS demo_company_id;
  CREATE TEMP TABLE demo_company_id AS SELECT v_demo_company_id AS id;
END $$;

-- ============================================================================
-- STEP 2: DEMO DRIVERS (8 drivers with various statuses)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_driver1_id UUID;
  v_driver2_id UUID;
  v_driver3_id UUID;
  v_driver4_id UUID;
  v_driver5_id UUID;
  v_driver6_id UUID;
  v_driver7_id UUID;
  v_driver8_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;

  -- Driver 1: Active, On Route
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'John Martinez',
    'john.martinez@demo.com',
    '(555) 111-2222',
    'DL-TX-1234567',
    CURRENT_DATE + INTERVAL '2 years',
    'on_route'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver1_id;

  -- Driver 2: Active, Available
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'Sarah Johnson',
    'sarah.johnson@demo.com',
    '(555) 222-3333',
    'DL-CA-9876543',
    CURRENT_DATE + INTERVAL '18 months',
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver2_id;

  -- Driver 3: Active, On Route
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'Mike Thompson',
    'mike.thompson@demo.com',
    '(555) 333-4444',
    'DL-FL-4567890',
    CURRENT_DATE + INTERVAL '3 years',
    'on_route'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver3_id;

  -- Driver 4: Active, Off Duty
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'Lisa Chen',
    'lisa.chen@demo.com',
    '(555) 444-5555',
    'DL-NY-1122334',
    CURRENT_DATE + INTERVAL '1 year',
    'off_duty'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver4_id;

  -- Driver 5: Active, Available
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'David Rodriguez',
    'david.rodriguez@demo.com',
    '(555) 555-6666',
    'DL-TX-2233445',
    CURRENT_DATE + INTERVAL '2 years',
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver5_id;

  -- Driver 6: Active, On Route
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'Emily Davis',
    'emily.davis@demo.com',
    '(555) 666-7777',
    'DL-CA-3344556',
    CURRENT_DATE + INTERVAL '2 years',
    'on_route'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver6_id;

  -- Driver 7: Active, Available
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'Robert Wilson',
    'robert.wilson@demo.com',
    '(555) 777-8888',
    'DL-IL-4455667',
    CURRENT_DATE + INTERVAL '18 months',
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver7_id;

  -- Driver 8: Inactive
  INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
  VALUES (
    v_company_id,
    'Jennifer Brown',
    'jennifer.brown@demo.com',
    '(555) 888-9999',
    'DL-TX-5566778',
    CURRENT_DATE + INTERVAL '6 months',
    'inactive'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_driver8_id;

  -- Store driver IDs
  DROP TABLE IF EXISTS demo_drivers;
  CREATE TEMP TABLE demo_drivers AS 
  SELECT v_driver1_id AS id, 'John Martinez' AS name UNION ALL
  SELECT v_driver2_id, 'Sarah Johnson' UNION ALL
  SELECT v_driver3_id, 'Mike Thompson' UNION ALL
  SELECT v_driver4_id, 'Lisa Chen' UNION ALL
  SELECT v_driver5_id, 'David Rodriguez' UNION ALL
  SELECT v_driver6_id, 'Emily Davis' UNION ALL
  SELECT v_driver7_id, 'Robert Wilson' UNION ALL
  SELECT v_driver8_id, 'Jennifer Brown';
END $$;

-- ============================================================================
-- STEP 3: DEMO TRUCKS (10 trucks with various statuses)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_truck1_id UUID;
  v_truck2_id UUID;
  v_truck3_id UUID;
  v_truck4_id UUID;
  v_truck5_id UUID;
  v_truck6_id UUID;
  v_truck7_id UUID;
  v_truck8_id UUID;
  v_truck9_id UUID;
  v_truck10_id UUID;
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_driver6_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM demo_drivers WHERE name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_driver6_id FROM demo_drivers WHERE name = 'Emily Davis' LIMIT 1;

  -- Truck 1: In Use (assigned to driver)
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-001',
    'Freightliner',
    'Cascadia',
    2022,
    '1FUJGHDV5NSHB1234',
    'TX-ABC123',
    'in_use',
    v_driver1_id,
    65,
    125000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck1_id;

  -- Truck 2: Available
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-002',
    'Peterbilt',
    '579',
    2021,
    '1NP5DB0X9NW123456',
    'CA-XYZ789',
    'available',
    85,
    98000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck2_id;

  -- Truck 3: In Use
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-003',
    'Kenworth',
    'T680',
    2023,
    '1XKDDB0X5NJ123456',
    'FL-DEF456',
    'in_use',
    v_driver3_id,
    45,
    45000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck3_id;

  -- Truck 4: Maintenance
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-004',
    'Volvo',
    'VNL',
    2020,
    '4V4NC9EH5NN123456',
    'NY-GHI789',
    'maintenance',
    20,
    180000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck4_id;

  -- Truck 5: Available
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-005',
    'Mack',
    'Anthem',
    2022,
    '1M1AX07Y9LM123456',
    'TX-JKL012',
    'available',
    90,
    75000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck5_id;

  -- Truck 6: In Use
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-006',
    'Freightliner',
    'Cascadia',
    2021,
    '1FUJGHDV5NSHB5678',
    'CA-MNO345',
    'in_use',
    v_driver6_id,
    55,
    110000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck6_id;

  -- Truck 7: Available
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-007',
    'Peterbilt',
    '389',
    2020,
    '1NP5DB0X9NW567890',
    'TX-PQR678',
    'available',
    75,
    145000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck7_id;

  -- Truck 8: Out of Service
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-008',
    'Kenworth',
    'T880',
    2019,
    '1XKDDB0X5NJ567890',
    'FL-STU901',
    'out_of_service',
    0,
    220000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck8_id;

  -- Truck 9: Available
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-009',
    'Volvo',
    'VNR',
    2023,
    '4V4NC9EH5NN567890',
    'CA-VWX234',
    'available',
    80,
    30000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck9_id;

  -- Truck 10: Available
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES (
    v_company_id,
    'TRK-010',
    'Mack',
    'Pinnacle',
    2021,
    '1M1AX07Y9LM567890',
    'TX-YZA567',
    'available',
    70,
    95000
  )
  ON CONFLICT (truck_number) DO NOTHING
  RETURNING id INTO v_truck10_id;

  -- Store truck IDs
  DROP TABLE IF EXISTS demo_trucks;
  CREATE TEMP TABLE demo_trucks AS 
  SELECT v_truck1_id AS id, 'TRK-001' AS number UNION ALL
  SELECT v_truck2_id, 'TRK-002' UNION ALL
  SELECT v_truck3_id, 'TRK-003' UNION ALL
  SELECT v_truck4_id, 'TRK-004' UNION ALL
  SELECT v_truck5_id, 'TRK-005' UNION ALL
  SELECT v_truck6_id, 'TRK-006' UNION ALL
  SELECT v_truck7_id, 'TRK-007' UNION ALL
  SELECT v_truck8_id, 'TRK-008' UNION ALL
  SELECT v_truck9_id, 'TRK-009' UNION ALL
  SELECT v_truck10_id, 'TRK-010';
END $$;

-- ============================================================================
-- STEP 4: DEMO CUSTOMERS (CRM)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_customer4_id UUID;
  v_customer5_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    -- Customer 1: Major Shipper
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES (
      v_company_id,
      'TechCorp Distribution',
      'TechCorp Distribution Inc.',
      'contact@techcorp.com',
      '(555) 200-1000',
      '1234 Industrial Blvd',
      'Los Angeles',
      'CA',
      '90001',
      'shipper',
      'active',
      'high',
      'Net 30',
      125000.00,
      45
    )
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer1_id;

    -- Customer 2: Broker
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES (
      v_company_id,
      'National Freight Brokers',
      'National Freight Brokers LLC',
      'dispatch@nationalfreight.com',
      '(555) 200-2000',
      '5678 Commerce Drive',
      'Chicago',
      'IL',
      '60601',
      'broker',
      'active',
      'high',
      'Net 15',
      98000.00,
      32
    )
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer2_id;

    -- Customer 3: Consignee
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES (
      v_company_id,
      'Metro Retail Chain',
      'Metro Retail Chain Stores',
      'logistics@metroretail.com',
      '(555) 200-3000',
      '8901 Retail Way',
      'New York',
      'NY',
      '10001',
      'consignee',
      'active',
      'normal',
      'Net 30',
      75000.00,
      28
    )
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer3_id;

    -- Customer 4: 3PL
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES (
      v_company_id,
      'Global Logistics Solutions',
      'Global Logistics Solutions Inc.',
      'operations@globallog.com',
      '(555) 200-4000',
      '2345 Logistics Park',
      'Dallas',
      'TX',
      '75201',
      '3pl',
      'active',
      'normal',
      'Net 20',
      65000.00,
      22
    )
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer4_id;

    -- Customer 5: Prospect
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms)
    VALUES (
      v_company_id,
      'Regional Manufacturing',
      'Regional Manufacturing Co.',
      'procurement@regionalmfg.com',
      '(555) 200-5000',
      '3456 Factory Road',
      'Atlanta',
      'GA',
      '30301',
      'shipper',
      'prospect',
      'normal',
      'Net 30'
    )
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer5_id;

    -- Store customer IDs
    DROP TABLE IF EXISTS demo_customers;
    CREATE TEMP TABLE demo_customers AS 
    SELECT v_customer1_id AS id, 'TechCorp Distribution' AS name UNION ALL
    SELECT v_customer2_id, 'National Freight Brokers' UNION ALL
    SELECT v_customer3_id, 'Metro Retail Chain' UNION ALL
    SELECT v_customer4_id, 'Global Logistics Solutions' UNION ALL
    SELECT v_customer5_id, 'Regional Manufacturing';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: DEMO VENDORS (CRM)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors') THEN
    INSERT INTO public.vendors (company_id, name, company_name, email, phone, address_line1, city, state, zip, vendor_type, status, payment_terms)
    VALUES
      (v_company_id, 'Quick Fuel Services', 'Quick Fuel Services Inc.', 'billing@quickfuel.com', '(555) 300-1000', '100 Fuel Lane', 'Dallas', 'TX', '75201', 'fuel', 'active', 'Net 15'),
      (v_company_id, 'ProTire Supply', 'ProTire Supply Co.', 'orders@protire.com', '(555) 300-2000', '200 Tire Avenue', 'Houston', 'TX', '77001', 'parts', 'active', 'Net 30'),
      (v_company_id, 'Mobile Mechanic Services', 'Mobile Mechanic Services LLC', 'service@mobilemech.com', '(555) 300-3000', '300 Service Road', 'San Antonio', 'TX', '78201', 'service', 'active', 'Net 20'),
      (v_company_id, 'Truck Wash Express', 'Truck Wash Express', 'info@truckwash.com', '(555) 300-4000', '400 Wash Street', 'Austin', 'TX', '78701', 'service', 'active', 'Net 15'),
      (v_company_id, 'Insurance Partners', 'Insurance Partners Group', 'claims@insurepartners.com', '(555) 300-5000', '500 Insurance Blvd', 'Dallas', 'TX', '75201', 'insurance', 'active', 'Net 30')
    ON CONFLICT (company_id, name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: DEMO LOADS (Various statuses)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_driver6_id UUID;
  v_truck1_id UUID;
  v_truck3_id UUID;
  v_truck6_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_route1_id UUID;
  v_route2_id UUID;
  v_route3_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  
  -- Only proceed if company_id exists
  IF v_company_id IS NULL THEN
    RETURN;
  END IF;
  
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM demo_drivers WHERE name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_driver6_id FROM demo_drivers WHERE name = 'Emily Davis' LIMIT 1;
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck3_id FROM demo_trucks WHERE number = 'TRK-003' LIMIT 1;
  SELECT id INTO v_truck6_id FROM demo_trucks WHERE number = 'TRK-006' LIMIT 1;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    SELECT id INTO v_customer1_id FROM demo_customers WHERE name = 'TechCorp Distribution' LIMIT 1;
    SELECT id INTO v_customer2_id FROM demo_customers WHERE name = 'National Freight Brokers' LIMIT 1;
    SELECT id INTO v_customer3_id FROM demo_customers WHERE name = 'Metro Retail Chain' LIMIT 1;
  END IF;

  -- Create routes first (separate INSERTs to get IDs) - only if drivers and trucks exist
  IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
    INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
    VALUES (v_company_id, 'LA to NYC Route', 'Los Angeles, CA', 'New York, NY', '2,800 mi', '45h', 'high', v_driver1_id, v_truck1_id, 'in_progress', NOW() + INTERVAL '2 days')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_route1_id;
  END IF;
  
  IF v_driver3_id IS NOT NULL AND v_truck3_id IS NOT NULL THEN
    INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
    VALUES (v_company_id, 'Dallas to Chicago', 'Dallas, TX', 'Chicago, IL', '925 mi', '14h', 'normal', v_driver3_id, v_truck3_id, 'in_progress', NOW() + INTERVAL '1 day')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_route2_id;
  END IF;
  
  IF v_driver6_id IS NOT NULL AND v_truck6_id IS NOT NULL THEN
    INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
    VALUES (v_company_id, 'Houston to Atlanta', 'Houston, TX', 'Atlanta, GA', '800 mi', '12h', 'normal', v_driver6_id, v_truck6_id, 'in_progress', NOW() + INTERVAL '18 hours')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_route3_id;
  END IF;

  -- Load 1: In Transit (only if route1 exists)
  IF v_route1_id IS NOT NULL AND v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery,
      customer_id
    )
    VALUES (
      v_company_id,
      'LOAD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0001',
      'Los Angeles, CA',
      'New York, NY',
      '22.5 tons',
      20412,
      'Electronics and consumer goods',
      150000.00,
      'dry-van',
      'in_transit',
      v_driver1_id,
      v_truck1_id,
      v_route1_id,
      CURRENT_DATE - INTERVAL '2 days',
      CURRENT_DATE + INTERVAL '3 days',
      v_customer1_id
    )
    ON CONFLICT (shipment_number) DO NOTHING;
  END IF;

  -- Load 2: Scheduled (only if driver3 and truck3 exist)
  IF v_driver3_id IS NOT NULL AND v_truck3_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, load_date, estimated_delivery,
      customer_id
    )
    VALUES (
      v_company_id,
      'LOAD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0002',
      'Dallas, TX',
      'Chicago, IL',
      '18 tons',
      16329,
      'Frozen food products',
      75000.00,
      'reefer',
      'scheduled',
      v_driver3_id,
      v_truck3_id,
      CURRENT_DATE + INTERVAL '1 day',
      CURRENT_DATE + INTERVAL '4 days',
      v_customer2_id
    )
    ON CONFLICT (shipment_number) DO NOTHING;
  END IF;

  -- Load 3: In Transit (only if route3 exists)
  IF v_route3_id IS NOT NULL AND v_driver6_id IS NOT NULL AND v_truck6_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery,
      customer_id
    )
    VALUES (
      v_company_id,
      'LOAD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0003',
      'Houston, TX',
      'Atlanta, GA',
      '16 tons',
      14515,
      'Construction materials',
      85000.00,
      'flatbed',
      'in_transit',
      v_driver6_id,
      v_truck6_id,
      v_route3_id,
      CURRENT_DATE - INTERVAL '1 day',
      CURRENT_DATE + INTERVAL '2 days',
      v_customer3_id
    )
    ON CONFLICT (shipment_number) DO NOTHING;
  END IF;

  -- Load 4: Pending
  INSERT INTO public.loads (
    company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
    carrier_type, status, load_date, estimated_delivery,
    customer_id
  )
  VALUES (
    v_company_id,
    'LOAD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0004',
    'San Francisco, CA',
    'Seattle, WA',
    '14 tons',
    12701,
    'Textile products',
    60000.00,
    'dry-van',
    'pending',
    CURRENT_DATE + INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '5 days',
    COALESCE(v_customer1_id, NULL)
  )
  ON CONFLICT (shipment_number) DO NOTHING;

  -- Load 5: Delivered
  INSERT INTO public.loads (
    company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
    carrier_type, status, load_date, estimated_delivery, actual_delivery,
    customer_id
  )
  VALUES (
    v_company_id,
    'LOAD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0005',
    'Phoenix, AZ',
    'Denver, CO',
    '20 tons',
    18144,
    'Automotive parts',
    95000.00,
    'dry-van',
    'delivered',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE - INTERVAL '2 days',
    COALESCE(v_customer2_id, NULL)
  )
  ON CONFLICT (shipment_number) DO NOTHING;

  -- Load 6: Delivered
  INSERT INTO public.loads (
    company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
    carrier_type, status, load_date, estimated_delivery, actual_delivery,
    customer_id
  )
  VALUES (
    v_company_id,
    'LOAD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0006',
    'Miami, FL',
    'Orlando, FL',
    '12 tons',
    10886,
    'Retail merchandise',
    45000.00,
    'dry-van',
    'delivered',
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE - INTERVAL '5 days',
    COALESCE(v_customer3_id, NULL)
  )
  ON CONFLICT (shipment_number) DO NOTHING;
END $$;

-- ============================================================================
-- STEP 7: DEMO INVOICES
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_load_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;

  -- Get a delivered load for invoice
  SELECT id INTO v_load_id FROM public.loads 
  WHERE company_id = v_company_id AND status = 'delivered' 
  LIMIT 1;

  IF v_load_id IS NOT NULL THEN
    -- Invoice 1: Paid
    INSERT INTO public.invoices (company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description)
    VALUES (
      v_company_id,
      'INV-' || TO_CHAR(CURRENT_DATE - INTERVAL '10 days', 'YYYY-MM') || '-001',
      'TechCorp Distribution',
      v_load_id,
      8500.00,
      'paid',
      CURRENT_DATE - INTERVAL '10 days',
      CURRENT_DATE - INTERVAL '5 days',
      'Net 30',
      'Freight charges for shipment LOAD-2024-0005'
    )
    ON CONFLICT (invoice_number) DO NOTHING;

    -- Invoice 2: Sent
    INSERT INTO public.invoices (company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description)
    VALUES (
      v_company_id,
      'INV-' || TO_CHAR(CURRENT_DATE - INTERVAL '5 days', 'YYYY-MM') || '-002',
      'National Freight Brokers',
      v_load_id,
      6200.00,
      'sent',
      CURRENT_DATE - INTERVAL '5 days',
      CURRENT_DATE + INTERVAL '25 days',
      'Net 30',
      'Freight charges for shipment LOAD-2024-0006'
    )
    ON CONFLICT (invoice_number) DO NOTHING;

    -- Invoice 3: Pending
    INSERT INTO public.invoices (company_id, invoice_number, customer_name, amount, status, issue_date, due_date, payment_terms, description)
    VALUES (
      v_company_id,
      'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM') || '-003',
      'Metro Retail Chain',
      9500.00,
      'pending',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      'Net 30',
      'Freight charges for upcoming shipment'
    )
    ON CONFLICT (invoice_number) DO NOTHING;

    -- Invoice 4: Overdue
    INSERT INTO public.invoices (company_id, invoice_number, customer_name, amount, status, issue_date, due_date, payment_terms, description)
    VALUES (
      v_company_id,
      'INV-' || TO_CHAR(CURRENT_DATE - INTERVAL '35 days', 'YYYY-MM') || '-004',
      'Global Logistics Solutions',
      7200.00,
      'overdue',
      CURRENT_DATE - INTERVAL '35 days',
      CURRENT_DATE - INTERVAL '5 days',
      'Net 30',
      'Freight charges - payment overdue'
    )
    ON CONFLICT (invoice_number) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: DEMO EXPENSES
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_truck1_id UUID;
  v_truck3_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM demo_drivers WHERE name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck3_id FROM demo_trucks WHERE number = 'TRK-003' LIMIT 1;

  INSERT INTO public.expenses (company_id, category, description, amount, date, vendor, driver_id, truck_id, mileage, payment_method, has_receipt)
  VALUES
    (v_company_id, 'fuel', 'Diesel fuel - Truck Stop #123', 450.00, CURRENT_DATE - INTERVAL '2 days', 'Quick Fuel Services', v_driver1_id, v_truck1_id, 124500, 'company_card', true),
    (v_company_id, 'fuel', 'Diesel fuel - Highway Station', 380.00, CURRENT_DATE - INTERVAL '1 day', 'Quick Fuel Services', v_driver3_id, v_truck3_id, 45000, 'company_card', true),
    (v_company_id, 'maintenance', 'Oil change and filter replacement', 125.00, CURRENT_DATE - INTERVAL '5 days', 'Mobile Mechanic Services', NULL, v_truck1_id, 124000, 'company_card', true),
    (v_company_id, 'tolls', 'Highway tolls - Route 66', 45.50, CURRENT_DATE - INTERVAL '1 day', 'State Toll Authority', v_driver1_id, v_truck1_id, 124600, 'ezpass', false),
    (v_company_id, 'food', 'Driver meal allowance', 35.00, CURRENT_DATE - INTERVAL '1 day', 'Restaurant', v_driver1_id, NULL, NULL, 'cash', false),
    (v_company_id, 'lodging', 'Driver hotel stay', 85.00, CURRENT_DATE - INTERVAL '2 days', 'Roadside Inn', v_driver1_id, NULL, NULL, 'company_card', true),
    (v_company_id, 'maintenance', 'Tire replacement - 2 tires', 650.00, CURRENT_DATE - INTERVAL '7 days', 'ProTire Supply', NULL, v_truck3_id, 44000, 'company_card', true),
    (v_company_id, 'other', 'Truck wash and detailing', 45.00, CURRENT_DATE - INTERVAL '3 days', 'Truck Wash Express', NULL, v_truck1_id, 124200, 'company_card', true);
END $$;

-- ============================================================================
-- STEP 9: DEMO SETTLEMENTS
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_driver6_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM demo_drivers WHERE name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_driver6_id FROM demo_drivers WHERE name = 'Emily Davis' LIMIT 1;

  INSERT INTO public.settlements (company_id, driver_id, period_start, period_end, gross_pay, fuel_deduction, advance_deduction, other_deductions, total_deductions, net_pay, status, payment_method)
  VALUES
    (v_company_id, v_driver1_id, CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE, 3200.00, 450.00, 200.00, 50.00, 700.00, 2500.00, 'pending', 'direct_deposit'),
    (v_company_id, v_driver3_id, CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE, 2850.00, 380.00, 150.00, 30.00, 560.00, 2290.00, 'pending', 'direct_deposit'),
    (v_company_id, v_driver6_id, CURRENT_DATE - INTERVAL '28 days', CURRENT_DATE - INTERVAL '14 days', 3100.00, 420.00, 0.00, 25.00, 445.00, 2655.00, 'paid', 'check'),
    (v_company_id, v_driver1_id, CURRENT_DATE - INTERVAL '28 days', CURRENT_DATE - INTERVAL '14 days', 2950.00, 400.00, 100.00, 40.00, 540.00, 2410.00, 'paid', 'direct_deposit')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- STEP 10: DEMO MAINTENANCE RECORDS
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_truck1_id UUID;
  v_truck3_id UUID;
  v_truck4_id UUID;
  v_truck6_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN;
  END IF;
  
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck3_id FROM demo_trucks WHERE number = 'TRK-003' LIMIT 1;
  SELECT id INTO v_truck4_id FROM demo_trucks WHERE number = 'TRK-004' LIMIT 1;
  SELECT id INTO v_truck6_id FROM demo_trucks WHERE number = 'TRK-006' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'maintenance') THEN
    -- Completed maintenance - only insert if trucks exist
    IF v_truck1_id IS NOT NULL THEN
      INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
      VALUES (v_company_id, v_truck1_id, 'Oil Change', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 124000, 'completed', 'normal', 125.00, 125.00, 'Mobile Mechanic Services', 'Standard oil change and filter replacement', 130000)
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF v_truck3_id IS NOT NULL THEN
      INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
      VALUES (v_company_id, v_truck3_id, 'Tire Replacement', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '7 days', 44000, 'completed', 'high', 650.00, 650.00, 'ProTire Supply', 'Replaced 2 front tires', 94000)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Scheduled maintenance
    IF v_truck4_id IS NOT NULL THEN
      INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
      VALUES (v_company_id, v_truck4_id, 'Engine Inspection', CURRENT_DATE + INTERVAL '2 days', NULL, 180000, 'scheduled', 'high', 500.00, NULL, 'Mobile Mechanic Services', 'Routine engine inspection and diagnostics', NULL)
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF v_truck6_id IS NOT NULL THEN
      INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
      VALUES (v_company_id, v_truck6_id, 'Brake Service', CURRENT_DATE + INTERVAL '5 days', NULL, 110000, 'scheduled', 'normal', 350.00, NULL, 'Mobile Mechanic Services', 'Brake pad replacement and inspection', 120000)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- In progress
    IF v_truck4_id IS NOT NULL THEN
      INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
      VALUES (v_company_id, v_truck4_id, 'Transmission Service', CURRENT_DATE, NULL, 180000, 'in_progress', 'high', 800.00, NULL, 'Mobile Mechanic Services', 'Transmission fluid change and filter', NULL)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 11: DEMO IFTA REPORTS
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_truck1_id UUID;
  v_truck3_id UUID;
  v_truck6_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck3_id FROM demo_trucks WHERE number = 'TRK-003' LIMIT 1;
  SELECT id INTO v_truck6_id FROM demo_trucks WHERE number = 'TRK-006' LIMIT 1;

  INSERT INTO public.ifta_reports (company_id, quarter, year, period, total_miles, fuel_purchased, tax_owed, status, filed_date, state_breakdown, truck_ids, include_eld)
  VALUES
    (v_company_id, 'Q4', EXTRACT(YEAR FROM CURRENT_DATE) - 1, 'Q4 ' || (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT, '45,230 mi', '5,200 gal', 1250.50, 'filed', CURRENT_DATE - INTERVAL '30 days', 
     '[{"state": "TX", "miles": 15230, "fuel": 1800, "tax": 420.15}, {"state": "CA", "miles": 12000, "fuel": 1400, "tax": 380.20}, {"state": "AZ", "miles": 8000, "fuel": 1000, "tax": 250.10}, {"state": "NM", "miles": 10000, "fuel": 1000, "tax": 200.05}]'::jsonb,
     ARRAY[v_truck1_id, v_truck3_id, v_truck6_id], true),
    (v_company_id, 'Q1', EXTRACT(YEAR FROM CURRENT_DATE), 'Q1 ' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT, '38,500 mi', '4,500 gal', 1050.75, 'draft', NULL,
     '[{"state": "TX", "miles": 18000, "fuel": 2100, "tax": 490.35}, {"state": "IL", "miles": 12000, "fuel": 1400, "tax": 320.20}, {"state": "MO", "miles": 8500, "fuel": 1000, "tax": 240.20}]'::jsonb,
     ARRAY[v_truck1_id, v_truck3_id], true)
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- STEP 12: DEMO DOCUMENTS
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_truck1_id UUID;
  v_truck2_id UUID;
  v_driver1_id UUID;
  v_driver2_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck2_id FROM demo_trucks WHERE number = 'TRK-002' LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver2_id FROM demo_drivers WHERE name = 'Sarah Johnson' LIMIT 1;

  INSERT INTO public.documents (company_id, name, type, file_url, file_size, upload_date, expiry_date, truck_id, driver_id)
  VALUES
    (v_company_id, 'TRK-001 Insurance Policy', 'insurance', 'https://storage.supabase.co/documents/insurance-trk001.pdf', 245000, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days', v_truck1_id, NULL),
    (v_company_id, 'TRK-002 Registration', 'license', 'https://storage.supabase.co/documents/registration-trk002.pdf', 180000, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days', v_truck2_id, NULL),
    (v_company_id, 'John Martinez CDL', 'license', 'https://storage.supabase.co/documents/cdl-john-martinez.pdf', 320000, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '635 days', NULL, v_driver1_id),
    (v_company_id, 'Sarah Johnson Medical Certificate', 'license', 'https://storage.supabase.co/documents/medical-sarah-johnson.pdf', 150000, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '320 days', NULL, v_driver2_id),
    (v_company_id, 'TRK-001 Maintenance Record', 'maintenance', 'https://storage.supabase.co/documents/maintenance-trk001.pdf', 95000, CURRENT_DATE - INTERVAL '5 days', NULL, v_truck1_id, NULL),
    (v_company_id, 'Invoice INV-2024-01-001', 'invoice', 'https://storage.supabase.co/documents/invoice-001.pdf', 125000, CURRENT_DATE - INTERVAL '10 days', NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- STEP 13: DEMO NOTIFICATIONS
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  
  -- Get first manager user for notifications
  SELECT id INTO v_user_id FROM public.users 
  WHERE company_id = v_company_id AND role = 'manager' 
  LIMIT 1;

  IF v_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    INSERT INTO public.notifications (user_id, company_id, type, title, message, priority, read)
    VALUES
      (v_user_id, v_company_id, 'route_update', 'Route Update: LA to NYC', 'John Martinez has reached 50% of route distance', 'normal', false),
      (v_user_id, v_company_id, 'load_update', 'Load Delivered', 'LOAD-2024-0005 has been successfully delivered', 'normal', false),
      (v_user_id, v_company_id, 'maintenance_alert', 'Maintenance Scheduled', 'TRK-004 scheduled for engine inspection in 2 days', 'high', false),
      (v_user_id, v_company_id, 'payment_reminder', 'Payment Overdue', 'Invoice INV-2024-11-004 is overdue by 5 days', 'critical', false),
      (v_user_id, v_company_id, 'alert', 'Low Fuel Alert', 'TRK-001 fuel level is below 50%', 'normal', true),
      (v_user_id, v_company_id, 'info', 'New Driver Added', 'Driver Emily Davis has been added to the system', 'low', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 14: DEMO DVIR RECORDS (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_truck1_id UUID;
  v_truck3_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM demo_drivers WHERE name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck3_id FROM demo_trucks WHERE number = 'TRK-003' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dvir_records') THEN
    INSERT INTO public.dvir_records (company_id, driver_id, truck_id, inspection_date, inspection_type, status, defects, notes, signature_url)
    VALUES
      (v_company_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'pre_trip', 'satisfactory', '[]'::jsonb, 'No defects found. All systems operational.', NULL),
      (v_company_id, v_driver3_id, v_truck3_id, CURRENT_DATE - INTERVAL '1 day', 'pre_trip', 'satisfactory', '[]'::jsonb, 'Vehicle in good condition.', NULL),
      (v_company_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '2 days', 'post_trip', 'satisfactory', '[]'::jsonb, 'Trip completed without issues.', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 15: DEMO ELD DATA (if tables exist)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_truck1_id UUID;
  v_truck3_id UUID;
  v_eld_device1_id UUID;
  v_eld_device2_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM demo_drivers WHERE name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_truck1_id FROM demo_trucks WHERE number = 'TRK-001' LIMIT 1;
  SELECT id INTO v_truck3_id FROM demo_trucks WHERE number = 'TRK-003' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_devices') AND v_truck1_id IS NOT NULL AND v_truck3_id IS NOT NULL THEN
    -- Get existing ELD device IDs or create new ones
    SELECT id INTO v_eld_device1_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2022-001234' LIMIT 1;
    
    IF v_eld_device1_id IS NULL THEN
      INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
      VALUES (v_company_id, v_truck1_id, 'ELD-TRK-001', 'ELD-2022-001234', 'keeptruckin', 'active')
      ON CONFLICT (device_serial_number) DO NOTHING
      RETURNING id INTO v_eld_device1_id;
      
      -- If still NULL, try to get it again (in case of conflict)
      IF v_eld_device1_id IS NULL THEN
        SELECT id INTO v_eld_device1_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2022-001234' LIMIT 1;
      END IF;
    END IF;
    
    SELECT id INTO v_eld_device2_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2023-005678' LIMIT 1;
    
    IF v_eld_device2_id IS NULL THEN
      INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
      VALUES (v_company_id, v_truck3_id, 'ELD-TRK-003', 'ELD-2023-005678', 'samsara', 'active')
      ON CONFLICT (device_serial_number) DO NOTHING
      RETURNING id INTO v_eld_device2_id;
      
      -- If still NULL, try to get it again (in case of conflict)
      IF v_eld_device2_id IS NULL THEN
        SELECT id INTO v_eld_device2_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2023-005678' LIMIT 1;
      END IF;
    END IF;

    -- Create ELD logs - only if devices exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_logs') THEN
      -- Only insert logs for device1 if it exists
      IF v_eld_device1_id IS NOT NULL AND v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
        INSERT INTO public.eld_logs (company_id, eld_device_id, driver_id, truck_id, log_date, log_type, start_time, end_time, duration_minutes, miles_driven)
        VALUES
          (v_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'driving', 
           (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '06:00:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:00:00', 240, 280),
          (v_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'on_duty', 
           (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:00:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:30:00', 30, 0),
          (v_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'driving', 
           (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:30:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '14:00:00', 210, 250),
          (v_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'off_duty', 
           (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '14:00:00', NULL, NULL, NULL)
        ON CONFLICT DO NOTHING;
      END IF;
      
      -- Only insert logs for device2 if it exists
      IF v_eld_device2_id IS NOT NULL AND v_driver3_id IS NOT NULL AND v_truck3_id IS NOT NULL THEN
        INSERT INTO public.eld_logs (company_id, eld_device_id, driver_id, truck_id, log_date, log_type, start_time, end_time, duration_minutes, miles_driven)
        VALUES
          (v_company_id, v_eld_device2_id, v_driver3_id, v_truck3_id, CURRENT_DATE - INTERVAL '1 day', 'driving', 
           (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '07:00:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '11:30:00', 270, 320),
          (v_company_id, v_eld_device2_id, v_driver3_id, v_truck3_id, CURRENT_DATE - INTERVAL '1 day', 'off_duty', 
           (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '11:30:00', NULL, NULL, NULL)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 16: DEMO BOL RECORDS (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_load_id UUID;
  v_driver1_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_load_id FROM public.loads WHERE company_id = v_company_id AND status = 'in_transit' LIMIT 1;
  SELECT id INTO v_driver1_id FROM demo_drivers WHERE name = 'John Martinez' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bols') AND v_load_id IS NOT NULL THEN
    INSERT INTO public.bols (company_id, load_id, bol_number, shipper_name, shipper_address, consignee_name, consignee_address, pickup_date, delivery_date, status)
    VALUES
      (v_company_id, v_load_id, 'BOL-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0001', 
       'TechCorp Distribution', '1234 Industrial Blvd, Los Angeles, CA 90001',
       'Metro Retail Chain', '5678 Commerce Drive, New York, NY 10001',
       CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'in_transit')
    ON CONFLICT (bol_number) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 17: DEMO WORK ORDERS (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_truck4_id UUID;
  v_maintenance_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN;
  END IF;
  
  SELECT id INTO v_truck4_id FROM demo_trucks WHERE number = 'TRK-004' LIMIT 1;
  SELECT id INTO v_maintenance_id FROM public.maintenance WHERE company_id = v_company_id AND status = 'in_progress' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_orders') 
     AND v_maintenance_id IS NOT NULL 
     AND v_truck4_id IS NOT NULL THEN
    INSERT INTO public.work_orders (company_id, truck_id, maintenance_id, work_order_number, title, description, status, priority, estimated_labor_hours, actual_labor_hours, estimated_total_cost, actual_total_cost)
    VALUES
      (v_company_id, v_truck4_id, v_maintenance_id, 'WO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0001',
       'Transmission Service', 'Transmission service and fluid change', 'in_progress', 'high',
       4.0, NULL, 800.00, NULL)
    ON CONFLICT (work_order_number) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 18: DEMO PARTS INVENTORY (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parts') THEN
    INSERT INTO public.parts (company_id, part_number, name, description, category, manufacturer, cost, quantity, min_quantity, location, supplier)
    VALUES
      (v_company_id, 'OIL-FLT-001', 'Engine Oil Filter', 'Standard engine oil filter', 'engine', 'Fleetguard', 12.50, 25, 10, 'Warehouse A - Shelf 3', 'ProTire Supply'),
      (v_company_id, 'TIRE-225-001', 'Truck Tire 225/70R19.5', 'Drive axle tire', 'tires', 'Michelin', 350.00, 8, 4, 'Warehouse B - Bay 2', 'ProTire Supply'),
      (v_company_id, 'BRAKE-PAD-001', 'Brake Pad Set', 'Front brake pad set', 'brakes', 'Bendix', 125.00, 12, 6, 'Warehouse A - Shelf 5', 'ProTire Supply'),
      (v_company_id, 'AIR-FLT-001', 'Air Filter', 'Cabin air filter', 'electrical', 'Fleetguard', 45.00, 15, 8, 'Warehouse A - Shelf 2', 'ProTire Supply'),
      (v_company_id, 'FUEL-FLT-001', 'Fuel Filter', 'Primary fuel filter', 'engine', 'Fleetguard', 28.00, 20, 10, 'Warehouse A - Shelf 4', 'ProTire Supply')
    ON CONFLICT (company_id, part_number) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 19: DEMO GEOFENCES (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences') THEN
    INSERT INTO public.geofences (company_id, name, description, zone_type, center_latitude, center_longitude, radius_meters, is_active, alert_on_entry, alert_on_exit, address, city, state, zip_code)
    VALUES
      (v_company_id, 'Main Warehouse', 'Primary distribution center', 'circle', 32.7767, -96.7970, 500, true, true, true, '1234 Transportation Blvd', 'Dallas', 'TX', '75201'),
      (v_company_id, 'Secondary Depot', 'Secondary storage facility', 'circle', 29.7604, -95.3698, 300, true, true, false, '5678 Storage Way', 'Houston', 'TX', '77001'),
      (v_company_id, 'Customer Site - TechCorp', 'TechCorp Distribution Center', 'circle', 34.0522, -118.2437, 200, true, true, true, '1234 Industrial Blvd', 'Los Angeles', 'CA', '90001')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 20: DEMO CRM CONTACTS (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    SELECT id INTO v_customer1_id FROM demo_customers WHERE name = 'TechCorp Distribution' LIMIT 1;
    SELECT id INTO v_customer2_id FROM demo_customers WHERE name = 'National Freight Brokers' LIMIT 1;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    -- Only insert contacts that have either customer_id or vendor_id (constraint requirement)
    -- Insert contacts for customer1 if it exists
    IF v_customer1_id IS NOT NULL THEN
      INSERT INTO public.contacts (company_id, customer_id, vendor_id, first_name, last_name, email, phone, title, role, is_primary)
      VALUES
        (v_company_id, v_customer1_id, NULL, 'John', 'Martinez', 'john.martinez@techcorp.com', '(555) 200-1001', 'Logistics Manager', 'operations', true),
        (v_company_id, v_customer1_id, NULL, 'Sarah', 'Johnson', 'sarah.johnson@techcorp.com', '(555) 200-1002', 'Dispatch Coordinator', 'operations', false),
        (v_company_id, v_customer1_id, NULL, 'Lisa', 'Chen', 'lisa.chen@demo.com', '(555) 200-3001', 'Operations Manager', 'operations', false)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Insert contacts for customer2 if it exists
    IF v_customer2_id IS NOT NULL THEN
      INSERT INTO public.contacts (company_id, customer_id, vendor_id, first_name, last_name, email, phone, title, role, is_primary)
      VALUES (v_company_id, v_customer2_id, NULL, 'Mike', 'Thompson', 'mike.thompson@nationalfreight.com', '(555) 200-2001', 'Broker', 'billing', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 21: DEMO AUDIT LOGS (if table exists)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_driver_id UUID;
  v_load_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM demo_company_id LIMIT 1;
  SELECT id INTO v_user_id FROM public.users WHERE company_id = v_company_id LIMIT 1;
  SELECT id INTO v_driver_id FROM demo_drivers LIMIT 1;
  SELECT id INTO v_load_id FROM public.loads WHERE company_id = v_company_id LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, resource_type, resource_id, details)
    VALUES
      (v_company_id, v_user_id, 'data.created', 'driver', v_driver_id, '{"field": "status", "new_value": "active"}'::jsonb),
      (v_company_id, v_user_id, 'data.updated', 'load', v_load_id, '{"field": "status", "old_value": "pending", "new_value": "in_transit"}'::jsonb),
      (v_company_id, v_user_id, 'status_updated', 'load', v_load_id, '{"field": "status", "old_value": "in_transit", "new_value": "delivered"}'::jsonb)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- DEMO DATA INSERTION COMPLETE!
-- ============================================================================
-- The platform is now populated with comprehensive demo data including:
-- - 1 Demo Company
-- - 8 Drivers (various statuses)
-- - 10 Trucks (various statuses)
-- - 5 Customers (CRM)
-- - 5 Vendors (CRM)
-- - 6 Loads (pending, scheduled, in_transit, delivered)
-- - 4 Invoices (paid, sent, pending, overdue)
-- - 8 Expenses (various categories)
-- - 4 Settlements (pending and paid)
-- - 5 Maintenance records (completed, scheduled, in_progress)
-- - 2 IFTA Reports (filed and draft)
-- - 6 Documents (insurance, licenses, maintenance, invoices)
-- - 6 Notifications (various types)
-- - 3 DVIR Records (if table exists)
-- - ELD Data (devices and logs if tables exist)
-- - BOL Records (if table exists)
-- - Work Orders (if table exists)
-- - Parts Inventory (if table exists)
-- - Geofences (if table exists)
-- - CRM Contacts (if table exists)
-- - Audit Logs (if table exists)
-- ============================================================================

