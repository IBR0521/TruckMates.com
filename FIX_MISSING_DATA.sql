-- ============================================================================
-- Fix Missing Demo Data - Create Trucks, Loads, and Invoices
-- ============================================================================
-- Run this to manually create the missing data for your demo company
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
  v_driver1_id UUID;
  v_driver3_id UUID;
  v_customer1_id UUID;
  v_route1_id UUID;
  v_load1_id UUID;
  v_load2_id UUID;
BEGIN
  -- Get demo company ID
  SELECT id INTO v_company_id 
  FROM public.companies 
  WHERE name = 'Demo Logistics Company' 
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Demo company not found';
  END IF;

  -- Get driver IDs
  SELECT id INTO v_driver1_id FROM public.drivers WHERE company_id = v_company_id AND name = 'John Martinez' LIMIT 1;
  SELECT id INTO v_driver3_id FROM public.drivers WHERE company_id = v_company_id AND name = 'Mike Thompson' LIMIT 1;
  
  -- Get customer ID
  SELECT id INTO v_customer1_id FROM public.customers WHERE company_id = v_company_id AND name = 'TechCorp Distribution' LIMIT 1;

  -- Create trucks with DEMO- prefix to avoid conflicts
  INSERT INTO public.trucks (company_id, truck_number, make, model, year, vin, license_plate, status, fuel_level, mileage)
  VALUES 
    (v_company_id, 'DEMO-TRK-001', 'Freightliner', 'Cascadia', 2022, '1FUJGHDV5NSBT1234', 'TX-ABC123', 'in_use', 85, 125000),
    (v_company_id, 'DEMO-TRK-002', 'Peterbilt', '579', 2021, '1NP5DB0X9ND123456', 'TX-DEF456', 'available', 90, 98000),
    (v_company_id, 'DEMO-TRK-003', 'Volvo', 'VNL', 2023, '4V4NC9EH7NN123456', 'TX-GHI789', 'in_use', 75, 45000),
    (v_company_id, 'DEMO-TRK-004', 'Kenworth', 'T680', 2022, '1XKDDB0X1NJ123456', 'TX-JKL012', 'maintenance', 60, 180000),
    (v_company_id, 'DEMO-TRK-005', 'Mack', 'Anthem', 2021, '1M1AX07Y9LM123456', 'TX-MNO345', 'available', 80, 110000),
    (v_company_id, 'DEMO-TRK-006', 'International', 'LT Series', 2023, '1HTMHAAM3PH123456', 'TX-PQR678', 'in_use', 70, 35000)
  ON CONFLICT (truck_number) DO NOTHING;

  -- Get truck IDs
  SELECT id INTO v_truck1_id FROM public.trucks WHERE company_id = v_company_id AND truck_number = 'DEMO-TRK-001' LIMIT 1;
  SELECT id INTO v_truck2_id FROM public.trucks WHERE company_id = v_company_id AND truck_number = 'DEMO-TRK-002' LIMIT 1;
  SELECT id INTO v_truck3_id FROM public.trucks WHERE company_id = v_company_id AND truck_number = 'DEMO-TRK-003' LIMIT 1;
  SELECT id INTO v_truck4_id FROM public.trucks WHERE company_id = v_company_id AND truck_number = 'DEMO-TRK-004' LIMIT 1;
  SELECT id INTO v_truck5_id FROM public.trucks WHERE company_id = v_company_id AND truck_number = 'DEMO-TRK-005' LIMIT 1;
  SELECT id INTO v_truck6_id FROM public.trucks WHERE company_id = v_company_id AND truck_number = 'DEMO-TRK-006' LIMIT 1;

  -- Create route if trucks and drivers exist
  IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL THEN
    INSERT INTO public.routes (company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, estimated_arrival)
    VALUES (v_company_id, 'LA to NYC Route', 'Los Angeles, CA', 'New York, NY', '2,800 mi', '45h', 'high', v_driver1_id, v_truck1_id, 'in_progress', NOW() + INTERVAL '2 days')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_route1_id;
    
    IF v_route1_id IS NULL THEN
      SELECT id INTO v_route1_id FROM public.routes WHERE company_id = v_company_id AND name = 'LA to NYC Route' LIMIT 1;
    END IF;
  END IF;

  -- Create loads
  IF v_driver1_id IS NOT NULL AND v_truck1_id IS NOT NULL AND v_route1_id IS NOT NULL AND v_customer1_id IS NOT NULL THEN
    INSERT INTO public.loads (
      company_id, shipment_number, origin, destination, weight, weight_kg, contents, value,
      carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery, customer_id
    )
    VALUES 
      (v_company_id, 'DEMO-LOAD-001', 'Los Angeles, CA', 'New York, NY', '22.5 tons', 20412, 'Electronics and consumer goods', 150000.00, 'dry-van', 'in_transit', v_driver1_id, v_truck1_id, v_route1_id, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days', v_customer1_id),
      (v_company_id, 'DEMO-LOAD-002', 'Dallas, TX', 'Chicago, IL', '18 tons', 16329, 'Frozen food products', 75000.00, 'reefer', 'scheduled', v_driver3_id, v_truck3_id, NULL, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', v_customer1_id),
      (v_company_id, 'DEMO-LOAD-003', 'Phoenix, AZ', 'Denver, CO', '15 tons', 13608, 'Furniture and home goods', 45000.00, 'dry-van', 'scheduled', v_driver1_id, v_truck2_id, NULL, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', v_customer1_id)
    ON CONFLICT (shipment_number) DO NOTHING;
    
    -- Get load IDs for invoices
    SELECT id INTO v_load1_id FROM public.loads WHERE company_id = v_company_id AND shipment_number = 'DEMO-LOAD-001' LIMIT 1;
    SELECT id INTO v_load2_id FROM public.loads WHERE company_id = v_company_id AND shipment_number = 'DEMO-LOAD-002' LIMIT 1;
  END IF;

  -- Create invoices
  IF v_load1_id IS NOT NULL THEN
    INSERT INTO public.invoices (company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description)
    VALUES 
      (v_company_id, 'DEMO-INV-001', 'TechCorp Distribution', v_load1_id, 15000.00, 'pending', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'Net 30', 'Freight charges for shipment DEMO-LOAD-001'),
      (v_company_id, 'DEMO-INV-002', 'National Freight Brokers', v_load2_id, 7500.00, 'sent', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '12 days', 'Net 15', 'Freight charges for shipment DEMO-LOAD-002'),
      (v_company_id, 'DEMO-INV-003', 'TechCorp Distribution', NULL, 4500.00, 'paid', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '5 days', 'Net 30', 'Freight charges for shipment DEMO-LOAD-003')
    ON CONFLICT (invoice_number) DO NOTHING;
  END IF;

  RAISE NOTICE 'Demo data created successfully!';
END $$;

-- Verify what was created
SELECT 
  'Trucks' as type,
  COUNT(*) as count
FROM public.trucks 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1)
  AND truck_number LIKE 'DEMO-%'

UNION ALL

SELECT 
  'Loads' as type,
  COUNT(*) as count
FROM public.loads 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1)
  AND shipment_number LIKE 'DEMO-%'

UNION ALL

SELECT 
  'Invoices' as type,
  COUNT(*) as count
FROM public.invoices 
WHERE company_id = (SELECT id FROM public.companies WHERE name = 'Demo Logistics Company' ORDER BY created_at DESC LIMIT 1)
  AND invoice_number LIKE 'DEMO-%';















