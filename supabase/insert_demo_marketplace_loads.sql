-- Insert Demo Marketplace Loads
-- This script inserts sample loads into the marketplace for testing purposes
-- 
-- Usage: Run this script in your Supabase SQL editor or via psql
-- The script will automatically find a broker company and assign loads to it
-- If you have multiple broker companies, it will use the first one it finds

-- IMPORTANT: Make sure you have at least one company with company_type = 'broker' or 'both'
-- If you don't have a broker company yet, create one first or change your existing company type

INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Los Angeles, CA' as origin,
  'New York, NY' as destination,
  '22.5 tons' as weight,
  20412 as weight_kg,
  'Electronics and consumer goods' as contents,
  150000.00 as value,
  8500.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '3 days' as pickup_date,
  CURRENT_DATE + INTERVAL '8 days' as delivery_date,
  'dry_van' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Time-sensitive delivery. Requires appointment for pickup and delivery.' as notes,
  'TechCorp Distribution' as shipper_name,
  'Los Angeles' as shipper_city,
  'CA' as shipper_state,
  'Metro Retail Chain' as consignee_name,
  'New York' as consignee_city,
  'NY' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 2: Reefer Load
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Dallas, TX' as origin,
  'Chicago, IL' as destination,
  '18 tons' as weight,
  16329 as weight_kg,
  'Frozen food products' as contents,
  75000.00 as value,
  3200.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '2 days' as pickup_date,
  CURRENT_DATE + INTERVAL '5 days' as delivery_date,
  'reefer' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Temperature controlled: -10°F. Requires liftgate at both ends.' as notes,
  'Cold Storage Solutions' as shipper_name,
  'Dallas' as shipper_city,
  'TX' as shipper_state,
  'Midwest Grocers' as consignee_name,
  'Chicago' as consignee_city,
  'IL' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 3: Flatbed Load
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Phoenix, AZ' as origin,
  'Atlanta, GA' as destination,
  '45 tons' as weight,
  40823 as weight_kg,
  'Construction equipment and materials' as contents,
  250000.00 as value,
  5200.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '4 days' as pickup_date,
  CURRENT_DATE + INTERVAL '7 days' as delivery_date,
  'flatbed' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Oversized load. Requires permits. Weekend delivery preferred.' as notes,
  'Southwest Construction Supply' as shipper_name,
  'Phoenix' as shipper_city,
  'AZ' as shipper_state,
  'Southeast Builders Inc' as consignee_name,
  'Atlanta' as consignee_city,
  'GA' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 4: Short Haul
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'San Francisco, CA' as origin,
  'Sacramento, CA' as destination,
  '15 tons' as weight,
  13608 as weight_kg,
  'Office furniture and supplies' as contents,
  45000.00 as value,
  1800.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '1 day' as pickup_date,
  CURRENT_DATE + INTERVAL '2 days' as delivery_date,
  'dry_van' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Inside delivery required. Call before arrival.' as notes,
  'Pacific Office Solutions' as shipper_name,
  'San Francisco' as shipper_city,
  'CA' as shipper_state,
  'State Capital Business Center' as consignee_name,
  'Sacramento' as consignee_city,
  'CA' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 5: Cross-Country Dry Van
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Seattle, WA' as origin,
  'Miami, FL' as destination,
  '20 tons' as weight,
  18144 as weight_kg,
  'Automotive parts and accessories' as contents,
  120000.00 as value,
  7200.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '5 days' as pickup_date,
  CURRENT_DATE + INTERVAL '12 days' as delivery_date,
  'dry_van' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Long haul load. Multiple stops possible. Flexible delivery date.' as notes,
  'Northwest Auto Parts' as shipper_name,
  'Seattle' as shipper_city,
  'WA' as shipper_state,
  'Sunshine Auto Distributors' as consignee_name,
  'Miami' as consignee_city,
  'FL' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 6: Per Mile Rate
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Denver, CO' as origin,
  'Portland, OR' as destination,
  '16 tons' as weight,
  14515 as weight_kg,
  'Textile products' as contents,
  60000.00 as value,
  2.15 as rate,
  'per_mile' as rate_type,
  CURRENT_DATE + INTERVAL '3 days' as pickup_date,
  CURRENT_DATE + INTERVAL '6 days' as delivery_date,
  'dry_van' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Per mile rate. Estimated distance: 1,200 miles. Payment upon delivery.' as notes,
  'Mountain Textiles' as shipper_name,
  'Denver' as shipper_city,
  'CO' as shipper_state,
  'Pacific Coast Fabrics' as consignee_name,
  'Portland' as consignee_city,
  'OR' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 7: Step Deck Load
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Houston, TX' as origin,
  'Detroit, MI' as destination,
  '38 tons' as weight,
  34473 as weight_kg,
  'Machinery and industrial equipment' as contents,
  180000.00 as value,
  4800.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '6 days' as pickup_date,
  CURRENT_DATE + INTERVAL '10 days' as delivery_date,
  'step_deck' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Heavy machinery. Requires experienced driver. Loading assistance available.' as notes,
  'Gulf Coast Manufacturing' as shipper_name,
  'Houston' as shipper_city,
  'TX' as shipper_state,
  'Motor City Industries' as consignee_name,
  'Detroit' as consignee_city,
  'MI' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Demo Load 8: Box Truck Load
INSERT INTO public.load_marketplace (
  broker_id,
  origin,
  destination,
  weight,
  weight_kg,
  contents,
  value,
  rate,
  rate_type,
  pickup_date,
  delivery_date,
  equipment_type,
  status,
  auto_create_enabled,
  notes,
  shipper_name,
  shipper_city,
  shipper_state,
  consignee_name,
  consignee_city,
  consignee_state
)
SELECT 
  c.id as broker_id,
  'Boston, MA' as origin,
  'Philadelphia, PA' as destination,
  '8 tons' as weight,
  7257 as weight_kg,
  'Medical supplies' as contents,
  85000.00 as value,
  1200.00 as rate,
  'flat_rate' as rate_type,
  CURRENT_DATE + INTERVAL '1 day' as pickup_date,
  CURRENT_DATE + INTERVAL '2 days' as delivery_date,
  'box_truck' as equipment_type,
  'available' as status,
  true as auto_create_enabled,
  'Priority delivery. Temperature sensitive items. Delivery within 24 hours of pickup.' as notes,
  'New England Medical Supply' as shipper_name,
  'Boston' as shipper_city,
  'MA' as shipper_state,
  'Eastern Health Services' as consignee_name,
  'Philadelphia' as consignee_city,
  'PA' as consignee_state
FROM public.companies c
WHERE c.company_type IN ('broker', 'both')
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify the loads were inserted
SELECT 
  id,
  origin,
  destination,
  equipment_type,
  rate,
  rate_type,
  status,
  pickup_date
FROM public.load_marketplace
WHERE broker_id IN (SELECT id FROM public.companies WHERE company_type IN ('broker', 'both'))
ORDER BY created_at DESC
LIMIT 10;

