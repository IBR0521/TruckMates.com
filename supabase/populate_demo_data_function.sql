-- ============================================================================
-- Automated Demo Data Population Function
-- ============================================================================
-- This function populates demo data for a company automatically
-- Called from the demo setup action - no manual SQL execution needed
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_demo_data_for_company(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_drivers_count INTEGER := 0;
  v_trucks_count INTEGER := 0;
  v_loads_count INTEGER := 0;
  v_routes_count INTEGER := 0;
  v_customers_count INTEGER := 0;
  v_invoices_count INTEGER := 0;
  v_driver1_id UUID;
  v_driver2_id UUID;
  v_driver3_id UUID;
  v_driver4_id UUID;
  v_driver5_id UUID;
  v_driver6_id UUID;
  v_driver7_id UUID;
  v_driver8_id UUID;
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
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_customer4_id UUID;
  v_customer5_id UUID;
  v_route1_id UUID;
  v_route2_id UUID;
  v_route3_id UUID;
  v_load_id UUID;
  v_maintenance_id UUID;
  v_eld_device1_id UUID;
  v_eld_device2_id UUID;
  v_load2_exists BOOLEAN;
  v_maint1_exists BOOLEAN;
  v_maint2_exists BOOLEAN;
  v_maint3_exists BOOLEAN;
  v_invoice_exists BOOLEAN;
  v_load2_id UUID;
  v_load3_id UUID;
  v_current_quarter TEXT;
  v_current_year INTEGER;
  v_prev_quarter TEXT;
  v_prev_year INTEGER;
BEGIN
  -- Verify company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;

  -- ============================================================================
  -- STEP 1: CREATE DEMO DRIVERS (check if they exist first)
  -- ============================================================================
  -- Get existing driver IDs first
  SELECT id INTO v_driver1_id FROM public.drivers WHERE company_id = p_company_id AND name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver2_id FROM public.drivers WHERE company_id = p_company_id AND name = 'Sarah Johnson' LIMIT 1;
  SELECT id INTO v_driver3_id FROM public.drivers WHERE company_id = p_company_id AND name = 'Mike Thompson' LIMIT 1;
  SELECT id INTO v_driver4_id FROM public.drivers WHERE company_id = p_company_id AND name = 'Lisa Chen' LIMIT 1;
  SELECT id INTO v_driver5_id FROM public.drivers WHERE company_id = p_company_id AND name = 'David Rodriguez' LIMIT 1;
  SELECT id INTO v_driver6_id FROM public.drivers WHERE company_id = p_company_id AND name = 'Emily Davis' LIMIT 1;
  SELECT id INTO v_driver7_id FROM public.drivers WHERE company_id = p_company_id AND name = 'Robert Wilson' LIMIT 1;
  SELECT id INTO v_driver8_id FROM public.drivers WHERE company_id = p_company_id AND name = 'Jennifer Brown' LIMIT 1;

  -- Insert only if they don't exist
  IF v_driver1_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'John Martinez', 'john.martinez@demo.com', '(555) 111-2222', 'DL-TX-1234567', CURRENT_DATE + INTERVAL '2 years', 'on_route')
    RETURNING id INTO v_driver1_id;
  END IF;
  
  IF v_driver2_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'Sarah Johnson', 'sarah.johnson@demo.com', '(555) 222-3333', 'DL-CA-2345678', CURRENT_DATE + INTERVAL '18 months', 'active')
    RETURNING id INTO v_driver2_id;
  END IF;
  
  IF v_driver3_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'Mike Thompson', 'mike.thompson@demo.com', '(555) 333-4444', 'DL-IL-3456789', CURRENT_DATE + INTERVAL '3 years', 'on_route')
    RETURNING id INTO v_driver3_id;
  END IF;
  
  IF v_driver4_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'Lisa Chen', 'lisa.chen@demo.com', '(555) 444-5555', 'DL-NY-4567890', CURRENT_DATE + INTERVAL '1 year', 'active')
    RETURNING id INTO v_driver4_id;
  END IF;
  
  IF v_driver5_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'David Rodriguez', 'david.rodriguez@demo.com', '(555) 555-6666', 'DL-FL-5678901', CURRENT_DATE + INTERVAL '2 years', 'active')
    RETURNING id INTO v_driver5_id;
  END IF;
  
  IF v_driver6_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'Emily Davis', 'emily.davis@demo.com', '(555) 666-7777', 'DL-CA-3344556', CURRENT_DATE + INTERVAL '2 years', 'on_route')
    RETURNING id INTO v_driver6_id;
  END IF;
  
  IF v_driver7_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'Robert Wilson', 'robert.wilson@demo.com', '(555) 777-8888', 'DL-IL-4455667', CURRENT_DATE + INTERVAL '18 months', 'active')
    RETURNING id INTO v_driver7_id;
  END IF;
  
  IF v_driver8_id IS NULL THEN
    INSERT INTO public.drivers (company_id, name, email, phone, license_number, license_expiry, status)
    VALUES (p_company_id, 'Jennifer Brown', 'jennifer.brown@demo.com', '(555) 888-9999', 'DL-TX-5566778', CURRENT_DATE + INTERVAL '6 months', 'inactive')
    RETURNING id INTO v_driver8_id;
  END IF;

  -- ============================================================================
  -- STEP 2: CREATE DEMO TRUCKS (check if they exist first)
  -- ============================================================================
  -- Get existing truck IDs first (filter by company_id to avoid conflicts)
  -- Use DEMO- prefix to avoid conflicts with other companies
  SELECT id INTO v_truck1_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-001' LIMIT 1;
  SELECT id INTO v_truck2_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-002' LIMIT 1;
  SELECT id INTO v_truck3_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-003' LIMIT 1;
  SELECT id INTO v_truck4_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-004' LIMIT 1;
  SELECT id INTO v_truck5_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-005' LIMIT 1;
  SELECT id INTO v_truck6_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-006' LIMIT 1;

  -- Insert trucks with ON CONFLICT to handle global UNIQUE constraint
  -- Use company-specific truck numbers to avoid conflicts
  IF v_truck1_id IS NULL THEN
    INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
    VALUES (p_company_id, 'DEMO-TRK-001', 'Freightliner', 'Cascadia', 2022, '1FUJGHDV5NSBT1234', 'TX-ABC123', 'in_use', 85, 125000)
    ON CONFLICT (truck_number) DO NOTHING
    RETURNING id INTO v_truck1_id;
    
    -- If still NULL (conflict), try to get it by company_id and number
    IF v_truck1_id IS NULL THEN
      SELECT id INTO v_truck1_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-001' LIMIT 1;
    END IF;
  END IF;
  
  IF v_truck2_id IS NULL THEN
    INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
    VALUES (p_company_id, 'DEMO-TRK-002', 'Peterbilt', '579', 2021, '1NP5DB0X9ND123456', 'TX-DEF456', 'available', 90, 98000)
    ON CONFLICT (truck_number) DO NOTHING
    RETURNING id INTO v_truck2_id;
    
    IF v_truck2_id IS NULL THEN
      SELECT id INTO v_truck2_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-002' LIMIT 1;
    END IF;
  END IF;
  
  IF v_truck3_id IS NULL THEN
    INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
    VALUES (p_company_id, 'DEMO-TRK-003', 'Volvo', 'VNL', 2023, '4V4NC9EH7NN123456', 'TX-GHI789', 'in_use', 75, 45000)
    ON CONFLICT (truck_number) DO NOTHING
    RETURNING id INTO v_truck3_id;
    
    IF v_truck3_id IS NULL THEN
      SELECT id INTO v_truck3_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-003' LIMIT 1;
    END IF;
  END IF;
  
  IF v_truck4_id IS NULL THEN
    INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
    VALUES (p_company_id, 'DEMO-TRK-004', 'Kenworth', 'T680', 2022, '1XKDDB0X1NJ123456', 'TX-JKL012', 'maintenance', 60, 180000)
    ON CONFLICT (truck_number) DO NOTHING
    RETURNING id INTO v_truck4_id;
    
    IF v_truck4_id IS NULL THEN
      SELECT id INTO v_truck4_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-004' LIMIT 1;
    END IF;
  END IF;
  
  IF v_truck5_id IS NULL THEN
    INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
    VALUES (p_company_id, 'DEMO-TRK-005', 'Mack', 'Anthem', 2021, '1M1AX07Y9LM123456', 'TX-MNO345', 'available', 80, 110000)
    ON CONFLICT (truck_number) DO NOTHING
    RETURNING id INTO v_truck5_id;
    
    IF v_truck5_id IS NULL THEN
      SELECT id INTO v_truck5_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-005' LIMIT 1;
    END IF;
  END IF;
  
  IF v_truck6_id IS NULL THEN
    INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
    VALUES (p_company_id, 'DEMO-TRK-006', 'International', 'LT Series', 2023, '1HTMHAAM3PH123456', 'TX-PQR678', 'in_use', 70, 35000)
    ON CONFLICT (truck_number) DO NOTHING
    RETURNING id INTO v_truck6_id;
    
    IF v_truck6_id IS NULL THEN
      SELECT id INTO v_truck6_id FROM public.trucks WHERE company_id = p_company_id AND truck_number = 'DEMO-TRK-006' LIMIT 1;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 3: CREATE DEMO CUSTOMERS (if table exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES
      (p_company_id, 'TechCorp Distribution', 'TechCorp Distribution Inc.', 'contact@techcorp.com', '(555) 200-1000', '1234 Industrial Blvd', 'Los Angeles', 'CA', '90001', 'shipper', 'active', 'high', 'Net 30', 250000.00, 45)
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer1_id;
    
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES
      (p_company_id, 'National Freight Brokers', 'National Freight Brokers LLC', 'dispatch@nationalfreight.com', '(555) 200-2000', '5678 Commerce Drive', 'Chicago', 'IL', '60601', 'broker', 'active', 'high', 'Net 15', 180000.00, 32)
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer2_id;
    
    INSERT INTO public.customers (company_id, name, company_name, email, phone, address_line1, city, state, zip, customer_type, status, priority, payment_terms, total_revenue, total_loads)
    VALUES
      (p_company_id, 'Metro Retail Chain', 'Metro Retail Chain Corp.', 'logistics@metroretail.com', '(555) 200-3000', '9012 Retail Avenue', 'New York', 'NY', '10001', 'shipper', 'active', 'normal', 'Net 30', 120000.00, 28)
    ON CONFLICT (company_id, name) DO NOTHING
    RETURNING id INTO v_customer3_id;

    -- Get customer IDs if they already exist
    SELECT id INTO v_customer1_id FROM public.customers WHERE company_id = p_company_id AND name = 'TechCorp Distribution' LIMIT 1;
    SELECT id INTO v_customer2_id FROM public.customers WHERE company_id = p_company_id AND name = 'National Freight Brokers' LIMIT 1;
    SELECT id INTO v_customer3_id FROM public.customers WHERE company_id = p_company_id AND name = 'Metro Retail Chain' LIMIT 1;
  END IF;

  -- ============================================================================
  -- STEP 4: CREATE DEMO ROUTES (only if drivers and trucks exist)
  -- ============================================================================
  IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
    -- Check if route already exists
    SELECT id INTO v_route1_id FROM public.routes WHERE company_id = p_company_id AND name = 'LA to NYC Route' LIMIT 1;
    
    IF v_route1_id IS NULL THEN
      INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
      VALUES (p_company_id, 'LA to NYC Route', 'Los Angeles, CA', 'New York, NY', '2,800 mi', '45h', 'high', v_driver1_id, v_truck1_id, 'in_progress', NOW() + INTERVAL '2 days')
      RETURNING id INTO v_route1_id;
    END IF;
  END IF;
  
  IF v_driver3_id IS NOT NULL AND v_truck3_id IS NOT NULL THEN
    -- Check if route already exists
    SELECT id INTO v_route2_id FROM public.routes WHERE company_id = p_company_id AND name = 'Dallas to Chicago' LIMIT 1;
    
    IF v_route2_id IS NULL THEN
      INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
      VALUES (p_company_id, 'Dallas to Chicago', 'Dallas, TX', 'Chicago, IL', '925 mi', '14h', 'normal', v_driver3_id, v_truck3_id, 'in_progress', NOW() + INTERVAL '1 day')
      RETURNING id INTO v_route2_id;
    END IF;
  END IF;
  
  IF v_driver6_id IS NOT NULL AND v_truck6_id IS NOT NULL THEN
    -- Check if route already exists
    SELECT id INTO v_route3_id FROM public.routes WHERE company_id = p_company_id AND name = 'Houston to Atlanta' LIMIT 1;
    
    IF v_route3_id IS NULL THEN
      INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
      VALUES (p_company_id, 'Houston to Atlanta', 'Houston, TX', 'Atlanta, GA', '800 mi', '12h', 'normal', v_driver6_id, v_truck6_id, 'in_progress', NOW() + INTERVAL '18 hours')
      RETURNING id INTO v_route3_id;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 5: CREATE DEMO LOADS (use DEMO- prefix to avoid conflicts)
  -- ============================================================================
  -- Create loads even if routes don't exist (route_id can be NULL)
  IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL AND v_customer1_id IS NOT NULL THEN
    -- Try to get existing load ID first
    SELECT id INTO v_load_id FROM public.loads WHERE company_id = p_company_id AND shipment_number = 'DEMO-LOAD-001' LIMIT 1;
    
    -- If not found, insert with ON CONFLICT to handle duplicates
    IF v_load_id IS NULL THEN
      INSERT INTO public.loads (
        company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
        carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery,
        customer_id
      )
      VALUES (
        p_company_id,
        'DEMO-LOAD-001',
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
      ON CONFLICT (shipment_number) DO NOTHING
      RETURNING id INTO v_load_id;
      
      -- If still NULL (conflict occurred), get the existing ID
      IF v_load_id IS NULL THEN
        SELECT id INTO v_load_id FROM public.loads WHERE company_id = p_company_id AND shipment_number = 'DEMO-LOAD-001' LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  IF v_driver3_id IS NOT NULL AND v_truck3_id IS NOT NULL AND v_customer2_id IS NOT NULL THEN
    -- Check if load already exists
    SELECT EXISTS(SELECT 1 FROM public.loads WHERE company_id = p_company_id AND shipment_number = 'DEMO-LOAD-002') INTO v_load2_exists;
    
    IF NOT v_load2_exists THEN
      INSERT INTO public.loads (
        company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
        carrier_type, status, driver_id, truck_id, load_date, estimated_delivery,
        customer_id
      )
      VALUES (
        p_company_id,
        'DEMO-LOAD-002',
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
  END IF;

  -- ============================================================================
  -- STEP 6: CREATE DEMO INVOICES (if loads exist)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    IF v_load_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.invoices 
        WHERE company_id = p_company_id 
          AND invoice_number = 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM') || '-0001'
      ) INTO v_invoice_exists;
      
      IF NOT v_invoice_exists THEN
        INSERT INTO public.invoices (company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description)
        VALUES (
          p_company_id,
          'DEMO-INV-001',
          'TechCorp Distribution',
          v_load_id,
          15000.00,
          'pending',
          CURRENT_DATE - INTERVAL '5 days',
          CURRENT_DATE + INTERVAL '25 days',
          'Net 30',
          'Freight charges for shipment DEMO-LOAD-001'
        )
        ON CONFLICT (invoice_number) DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 7: CREATE DEMO MAINTENANCE (if trucks exist)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'maintenance') THEN
    IF v_truck1_id IS NOT NULL THEN
      -- Check if maintenance record already exists
      SELECT EXISTS(
        SELECT 1 FROM public.maintenance 
        WHERE company_id = p_company_id 
          AND truck_id = v_truck1_id 
          AND service_type = 'Oil Change'
          AND scheduled_date = CURRENT_DATE - INTERVAL '5 days'
      ) INTO v_maint1_exists;
      
      IF NOT v_maint1_exists THEN
        INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
        VALUES (p_company_id, v_truck1_id, 'Oil Change', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 124000, 'completed', 'normal', 125.00, 125.00, 'Mobile Mechanic Services', 'Standard oil change and filter replacement', 130000);
      END IF;
    END IF;
    
    IF v_truck3_id IS NOT NULL THEN
      -- Check if maintenance record already exists
      SELECT EXISTS(
        SELECT 1 FROM public.maintenance 
        WHERE company_id = p_company_id 
          AND truck_id = v_truck3_id 
          AND service_type = 'Tire Replacement'
          AND scheduled_date = CURRENT_DATE - INTERVAL '7 days'
      ) INTO v_maint2_exists;
      
      IF NOT v_maint2_exists THEN
        INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
        VALUES (p_company_id, v_truck3_id, 'Tire Replacement', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '7 days', 44000, 'completed', 'high', 650.00, 650.00, 'ProTire Supply', 'Replaced 2 front tires', 94000);
      END IF;
    END IF;
    
    IF v_truck4_id IS NOT NULL THEN
      -- Check if maintenance record already exists
      SELECT EXISTS(
        SELECT 1 FROM public.maintenance 
        WHERE company_id = p_company_id 
          AND truck_id = v_truck4_id 
          AND service_type = 'Transmission Service'
          AND status = 'in_progress'
      ) INTO v_maint3_exists;
      
      IF NOT v_maint3_exists THEN
        INSERT INTO public.maintenance (company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, notes, next_service_due_mileage)
        VALUES (p_company_id, v_truck4_id, 'Transmission Service', CURRENT_DATE, NULL, 180000, 'in_progress', 'high', 800.00, NULL, 'Mobile Mechanic Services', 'Transmission fluid change and filter', NULL)
        RETURNING id INTO v_maintenance_id;
      ELSE
        SELECT id INTO v_maintenance_id FROM public.maintenance 
        WHERE company_id = p_company_id 
          AND truck_id = v_truck4_id 
          AND service_type = 'Transmission Service'
          AND status = 'in_progress'
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 8: CREATE DEMO ELD DEVICES (if trucks exist) - Create for ALL trucks
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_devices') THEN
    -- ELD Device 1
    IF v_truck1_id IS NOT NULL THEN
      SELECT id INTO v_eld_device1_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2022-001234' LIMIT 1;
      
      IF v_eld_device1_id IS NULL THEN
        INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
        VALUES (p_company_id, v_truck1_id, 'ELD-TRK-001', 'ELD-2022-001234', 'keeptruckin', 'active')
        ON CONFLICT (device_serial_number) DO NOTHING
        RETURNING id INTO v_eld_device1_id;
        
        IF v_eld_device1_id IS NULL THEN
          SELECT id INTO v_eld_device1_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2022-001234' LIMIT 1;
        END IF;
      END IF;
    END IF;
    
    -- ELD Device 2
    IF v_truck3_id IS NOT NULL THEN
      SELECT id INTO v_eld_device2_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2023-005678' LIMIT 1;
      
      IF v_eld_device2_id IS NULL THEN
        INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
        VALUES (p_company_id, v_truck3_id, 'ELD-TRK-003', 'ELD-2023-005678', 'samsara', 'active')
        ON CONFLICT (device_serial_number) DO NOTHING
        RETURNING id INTO v_eld_device2_id;
        
        IF v_eld_device2_id IS NULL THEN
          SELECT id INTO v_eld_device2_id FROM public.eld_devices WHERE device_serial_number = 'ELD-2023-005678' LIMIT 1;
        END IF;
      END IF;
    END IF;

    -- Add more ELD devices for other trucks
    IF v_truck2_id IS NOT NULL THEN
      INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
      VALUES (p_company_id, v_truck2_id, 'ELD-TRK-002', 'ELD-2021-002345', 'omnitracs', 'active')
      ON CONFLICT (device_serial_number) DO NOTHING;
    END IF;

    IF v_truck4_id IS NOT NULL THEN
      INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
      VALUES (p_company_id, v_truck4_id, 'ELD-TRK-004', 'ELD-2022-003456', 'geotab', 'active')
      ON CONFLICT (device_serial_number) DO NOTHING;
    END IF;

    IF v_truck5_id IS NOT NULL THEN
      INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
      VALUES (p_company_id, v_truck5_id, 'ELD-TRK-005', 'ELD-2021-004567', 'keeptruckin', 'active')
      ON CONFLICT (device_serial_number) DO NOTHING;
    END IF;

    IF v_truck6_id IS NOT NULL THEN
      INSERT INTO public.eld_devices (company_id, truck_id, device_name, device_serial_number, provider, status)
      VALUES (p_company_id, v_truck6_id, 'ELD-TRK-006', 'ELD-2023-005789', 'samsara', 'active')
      ON CONFLICT (device_serial_number) DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 9: CREATE MORE LOADS (comprehensive coverage)
  -- ============================================================================
  -- Create additional loads with various statuses (use DEMO- prefix)
  IF v_driver2_id IS NOT NULL AND v_truck2_id IS NOT NULL AND v_customer1_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, load_date, estimated_delivery, customer_id
    )
    VALUES (
      p_company_id, 'DEMO-LOAD-003',
      'Phoenix, AZ', 'Denver, CO', '15 tons', 13608, 'Furniture and home goods', 45000.00,
      'dry-van', 'scheduled', v_driver2_id, v_truck2_id,
      CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', v_customer1_id
    )
    ON CONFLICT (shipment_number) DO NOTHING;
  END IF;

  IF v_driver4_id IS NOT NULL AND v_truck5_id IS NOT NULL AND v_customer2_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, load_date, estimated_delivery, customer_id
    )
    VALUES (
      p_company_id, 'DEMO-LOAD-004',
      'Seattle, WA', 'Portland, OR', '12 tons', 10886, 'Electronics', 85000.00,
      'dry-van', 'delivered', v_driver4_id, v_truck5_id,
      CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '2 days', v_customer2_id
    )
    ON CONFLICT (shipment_number) DO NOTHING;
  END IF;

  IF v_driver5_id IS NOT NULL AND v_truck6_id IS NOT NULL AND v_customer3_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, load_date, estimated_delivery, customer_id
    )
    VALUES (
      p_company_id, 'DEMO-LOAD-005',
      'Miami, FL', 'Atlanta, GA', '20 tons', 18144, 'Fresh produce', 35000.00,
      'reefer', 'in_transit', v_driver5_id, v_truck6_id,
      CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', v_customer3_id
    )
    ON CONFLICT (shipment_number) DO NOTHING;
  END IF;

  -- ============================================================================
  -- STEP 10: CREATE BOLS (Bills of Lading) for loads
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bols') THEN
    IF v_load_id IS NOT NULL THEN
      INSERT INTO public.bols (
        company_id, load_id, bol_number, shipper_name, shipper_address, shipper_city, shipper_state, shipper_zip,
        consignee_name, consignee_address, consignee_city, consignee_state, consignee_zip,
        pickup_date, delivery_date, status, freight_charges
      )
      VALUES (
        p_company_id, v_load_id, 'BOL-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-0001',
        'TechCorp Distribution', '1234 Industrial Blvd', 'Los Angeles', 'CA', '90001',
        'Metro Retail Chain', '5678 Commerce Drive', 'New York', 'NY', '10001',
        CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', 'signed', 15000.00
      )
      ON CONFLICT (bol_number) DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 11: CREATE EXPENSES (fuel, maintenance, tolls, food, lodging)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    -- Fuel expenses
    IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
      INSERT INTO public.expenses (company_id, category, description, amount, date, driver_id, truck_id, vendor, payment_method)
      VALUES 
        (p_company_id, 'fuel', 'Diesel fuel - Pilot Travel Center', 450.00, CURRENT_DATE - INTERVAL '1 day', v_driver1_id, v_truck1_id, 'Pilot Travel Center', 'company_card'),
        (p_company_id, 'fuel', 'Diesel fuel - Love''s Travel Stop', 380.00, CURRENT_DATE - INTERVAL '3 days', v_driver1_id, v_truck1_id, 'Love''s Travel Stop', 'company_card')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Maintenance expenses
    IF v_truck1_id IS NOT NULL THEN
      INSERT INTO public.expenses (company_id, category, description, amount, date, truck_id, vendor, payment_method)
      VALUES 
        (p_company_id, 'maintenance', 'Oil change and filter', 125.00, CURRENT_DATE - INTERVAL '5 days', v_truck1_id, 'Mobile Mechanic Services', 'company_card'),
        (p_company_id, 'maintenance', 'Tire replacement', 650.00, CURRENT_DATE - INTERVAL '7 days', v_truck3_id, 'ProTire Supply', 'company_card')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Tolls
    IF v_driver1_id IS NOT NULL THEN
      INSERT INTO public.expenses (company_id, category, description, amount, date, driver_id, payment_method)
      VALUES 
        (p_company_id, 'tolls', 'E-ZPass toll charges', 85.50, CURRENT_DATE - INTERVAL '1 day', v_driver1_id, 'e_zpass'),
        (p_company_id, 'tolls', 'Highway tolls', 42.00, CURRENT_DATE - INTERVAL '2 days', v_driver3_id, 'cash')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Food and lodging
    IF v_driver1_id IS NOT NULL THEN
      INSERT INTO public.expenses (company_id, category, description, amount, date, driver_id, payment_method)
      VALUES 
        (p_company_id, 'food', 'Meals - Restaurant', 45.00, CURRENT_DATE - INTERVAL '1 day', v_driver1_id, 'company_card'),
        (p_company_id, 'lodging', 'Hotel - Rest stop', 75.00, CURRENT_DATE - INTERVAL '1 day', v_driver1_id, 'company_card')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 12: CREATE DVIR REPORTS (Driver Vehicle Inspection Reports)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dvir') THEN
    IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
      INSERT INTO public.dvir (
        company_id, driver_id, truck_id, inspection_type, inspection_date, status, safe_to_operate, defects_found, defects
      )
      VALUES 
        (p_company_id, v_driver1_id, v_truck1_id, 'pre_trip', CURRENT_DATE, 'passed', true, false, '[]'::jsonb),
        (p_company_id, v_driver1_id, v_truck1_id, 'post_trip', CURRENT_DATE - INTERVAL '1 day', 'passed', true, false, '[]'::jsonb),
        (p_company_id, v_driver3_id, v_truck3_id, 'pre_trip', CURRENT_DATE, 'defects_corrected', true, true, '[{"component": "lights", "description": "Left headlight dim", "severity": "minor", "corrected": true}]'::jsonb),
        (p_company_id, v_driver2_id, v_truck2_id, 'pre_trip', CURRENT_DATE - INTERVAL '2 days', 'passed', true, false, '[]'::jsonb),
        (p_company_id, v_driver4_id, v_truck5_id, 'post_trip', CURRENT_DATE - INTERVAL '1 day', 'passed', true, false, '[]'::jsonb)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 13: CREATE GEOFENCES
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences') THEN
    INSERT INTO public.geofences (
      company_id, name, zone_type, center_latitude, center_longitude, radius_meters, is_active, address, city, state
    )
    VALUES 
      (p_company_id, 'Los Angeles Distribution Center', 'circle', 34.0522, -118.2437, 500, true, '1234 Industrial Blvd', 'Los Angeles', 'CA'),
      (p_company_id, 'New York Warehouse', 'circle', 40.7128, -74.0060, 300, true, '5678 Commerce Drive', 'New York', 'NY'),
      (p_company_id, 'Dallas Hub', 'circle', 32.7767, -96.7970, 400, true, '9012 Logistics Way', 'Dallas', 'TX')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================================
  -- STEP 14: CREATE CONTACTS (customer/vendor contacts)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    IF v_customer1_id IS NOT NULL THEN
      INSERT INTO public.contacts (
        company_id, customer_id, first_name, last_name, email, phone, title, role, is_primary
      )
      VALUES 
        (p_company_id, v_customer1_id, 'John', 'Martinez', 'john.martinez@techcorp.com', '(555) 200-1001', 'Logistics Manager', 'operations', true),
        (p_company_id, v_customer1_id, 'Sarah', 'Johnson', 'sarah.johnson@techcorp.com', '(555) 200-1002', 'Dispatch Coordinator', 'operations', false),
        (p_company_id, v_customer2_id, 'Mike', 'Thompson', 'mike.thompson@nationalfreight.com', '(555) 200-2001', 'Broker', 'billing', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 15: CREATE ELD LOGS (Hours of Service logs)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eld_logs') THEN
    IF v_eld_device1_id IS NOT NULL AND v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
      INSERT INTO public.eld_logs (
        company_id, eld_device_id, driver_id, truck_id, log_date, log_type, start_time, end_time, duration_minutes, miles_driven
      )
      VALUES 
        (p_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'driving', 
         (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '06:00:00', 
         (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:00:00', 240, 280),
        (p_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'on_duty', 
         (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:00:00', 
         (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:30:00', 30, 0),
        (p_company_id, v_eld_device1_id, v_driver1_id, v_truck1_id, CURRENT_DATE - INTERVAL '1 day', 'driving', 
         (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '10:30:00', 
         (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '14:00:00', 210, 250)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 16: CREATE IFTA REPORTS
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ifta_reports') THEN
    -- Get current quarter
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    v_current_quarter := 'Q' || TO_CHAR(CEIL(EXTRACT(MONTH FROM CURRENT_DATE)::NUMERIC / 3), 'FM9');

    -- Create IFTA report for current quarter
    INSERT INTO public.ifta_reports (
      company_id, quarter, year, period, total_miles, fuel_purchased, tax_owed, status, truck_ids
    )
    VALUES (
      p_company_id, v_current_quarter, v_current_year, 
      v_current_quarter || ' ' || v_current_year::TEXT,
      '15,234', '1,234.56', 1250.50, 'draft',
      ARRAY[v_truck1_id, v_truck2_id, v_truck3_id]::UUID[]
    )
    ON CONFLICT DO NOTHING;

    -- Create IFTA report for previous quarter (filed)
    IF v_current_quarter = 'Q1' THEN
      v_prev_quarter := 'Q4';
      v_prev_year := v_current_year - 1;
    ELSE
      v_prev_quarter := 'Q' || (CAST(SUBSTRING(v_current_quarter, 2) AS INTEGER) - 1)::TEXT;
      v_prev_year := v_current_year;
    END IF;

    INSERT INTO public.ifta_reports (
      company_id, quarter, year, period, total_miles, fuel_purchased, tax_owed, status, filed_date, truck_ids
    )
    VALUES (
      p_company_id, v_prev_quarter, v_prev_year,
      v_prev_quarter || ' ' || v_prev_year::TEXT,
      '14,567', '1,189.23', 1180.75, 'filed',
      CURRENT_DATE - INTERVAL '30 days',
      ARRAY[v_truck1_id, v_truck2_id]::UUID[]
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================================
  -- STEP 17: CREATE ADDRESS BOOK ENTRIES
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'address_book') THEN
    INSERT INTO public.address_book (
      company_id, name, company_name, contact_name, email, phone,
      address_line1, city, state, zip_code, country, category, geocoding_status
    )
    VALUES 
      (p_company_id, 'TechCorp Warehouse', 'TechCorp Distribution Inc.', 'John Martinez', 'john.martinez@techcorp.com', '(555) 200-1001',
       '1234 Industrial Blvd', 'Los Angeles', 'CA', '90001', 'USA', 'shipper', 'verified'),
      (p_company_id, 'Metro Retail Distribution', 'Metro Retail Chain Corp.', 'Sarah Johnson', 'sarah.johnson@metroretail.com', '(555) 200-3001',
       '5678 Commerce Drive', 'New York', 'NY', '10001', 'USA', 'receiver', 'verified'),
      (p_company_id, 'National Freight Hub', 'National Freight Brokers LLC', 'Mike Thompson', 'mike.thompson@nationalfreight.com', '(555) 200-2001',
       '9012 Logistics Way', 'Chicago', 'IL', '60601', 'USA', 'broker', 'verified'),
      (p_company_id, 'Mobile Mechanic Services', 'Mobile Mechanic Services', 'Lisa Chen', 'lisa@mobilemech.com', '(555) 300-1001',
       '3456 Service Road', 'Dallas', 'TX', '75201', 'USA', 'vendor', 'verified'),
      (p_company_id, 'Pilot Travel Center', 'Pilot Flying J', NULL, NULL, '(555) 400-1001',
       '7890 Highway 101', 'Phoenix', 'AZ', '85001', 'USA', 'fuel_station', 'verified')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================================
  -- STEP 18: CREATE SETTLEMENTS (driver payments)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settlements') THEN
    IF v_driver1_id IS NOT NULL THEN
      INSERT INTO public.settlements (
        company_id, driver_id, period_start, period_end, gross_pay, fuel_deduction, advance_deduction,
        total_deductions, net_pay, status, payment_method
      )
      VALUES 
        (p_company_id, v_driver1_id, CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day',
         3500.00, 450.00, 200.00, 650.00, 2850.00, 'paid', 'direct_deposit'),
        (p_company_id, v_driver3_id, CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day',
         3200.00, 380.00, 150.00, 530.00, 2670.00, 'pending', 'check')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 17: CREATE MORE INVOICES
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    -- Get load IDs for invoices (using DEMO- prefix)
    SELECT id INTO v_load2_id FROM public.loads WHERE company_id = p_company_id AND shipment_number = 'DEMO-LOAD-002' LIMIT 1;
    SELECT id INTO v_load3_id FROM public.loads WHERE company_id = p_company_id AND shipment_number = 'DEMO-LOAD-003' LIMIT 1;

    IF v_load2_id IS NOT NULL THEN
      INSERT INTO public.invoices (company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description)
      VALUES (
        p_company_id, 'DEMO-INV-002',
        'National Freight Brokers', v_load2_id, 7500.00, 'sent',
        CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '12 days', 'Net 15',
        'Freight charges for shipment DEMO-LOAD-002'
      )
      ON CONFLICT (invoice_number) DO NOTHING;
    END IF;

    IF v_load3_id IS NOT NULL THEN
      INSERT INTO public.invoices (company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description)
      VALUES (
        p_company_id, 'DEMO-INV-003',
        'TechCorp Distribution', v_load3_id, 4500.00, 'paid',
        CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '5 days', 'Net 30',
        'Freight charges for shipment DEMO-LOAD-003'
      )
      ON CONFLICT (invoice_number) DO NOTHING;
    END IF;
  END IF;

  -- Get counts of created data
  SELECT COUNT(*) INTO v_drivers_count FROM public.drivers WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_trucks_count FROM public.trucks WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_loads_count FROM public.loads WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_routes_count FROM public.routes WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_customers_count FROM public.customers WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_invoices_count FROM public.invoices WHERE company_id = p_company_id;
  
  -- Return success with comprehensive counts
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Demo data populated successfully',
    'counts', jsonb_build_object(
      'drivers', v_drivers_count,
      'trucks', v_trucks_count,
      'loads', v_loads_count,
      'routes', v_routes_count,
      'customers', v_customers_count,
      'invoices', v_invoices_count,
      'eld_devices', (SELECT COUNT(*) FROM public.eld_devices WHERE company_id = p_company_id),
      'dvir_reports', (SELECT COUNT(*) FROM public.dvir WHERE company_id = p_company_id),
      'ifta_reports', (SELECT COUNT(*) FROM public.ifta_reports WHERE company_id = p_company_id),
      'expenses', (SELECT COUNT(*) FROM public.expenses WHERE company_id = p_company_id),
      'maintenance', (SELECT COUNT(*) FROM public.maintenance WHERE company_id = p_company_id),
      'geofences', (SELECT COUNT(*) FROM public.geofences WHERE company_id = p_company_id),
      'address_book', (SELECT COUNT(*) FROM public.address_book WHERE company_id = p_company_id),
      'settlements', (SELECT COUNT(*) FROM public.settlements WHERE company_id = p_company_id),
      'bols', (SELECT COUNT(*) FROM public.bols WHERE company_id = p_company_id)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION populate_demo_data_for_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION populate_demo_data_for_company(UUID) TO service_role;

COMMENT ON FUNCTION populate_demo_data_for_company IS 
  'Automatically populates demo data for a company. Called from demo setup - no manual SQL execution needed.';

