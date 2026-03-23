-- ============================================================================
-- MIGRATION VERIFICATION SCRIPT
-- ============================================================================
-- Run this script to verify all migrations were applied correctly
-- ============================================================================

-- Check invoices table columns
SELECT 
  'invoices' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'invoices'
  AND column_name IN (
    'notes',
    'paid_amount',
    'paid_date',
    'payment_method',
    'tax_amount',
    'tax_rate',
    'subtotal',
    'customer_id',
    'stripe_payment_intent_id',
    'paypal_order_id',
    'stripe_invoice_id'
  )
ORDER BY column_name;

-- Check loads table critical columns
SELECT 
  'loads' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'loads'
  AND column_name IN (
    'company_name',
    'priority',
    'status_color',
    'urgency_score',
    'source',
    'marketplace_load_id',
    'delivery_type',
    'total_delivery_points',
    'customer_reference',
    'requires_split_delivery',
    'shipper_address_book_id',
    'consignee_address_book_id',
    'load_type',
    'customer_id',
    'shipper_name',
    'consignee_name',
    'total_rate',
    'estimated_revenue',
    'notes'
  )
ORDER BY column_name;

-- Check routes table critical columns
SELECT 
  'routes' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'routes'
  AND column_name IN (
    'depot_name',
    'depot_address',
    'pre_route_time_minutes',
    'post_route_time_minutes',
    'route_start_time',
    'route_departure_time',
    'route_complete_time',
    'route_type',
    'scenario',
    'route_linestring',
    'origin_coordinates',
    'destination_coordinates',
    'current_eta',
    'last_eta_update',
    'eta_confidence'
  )
ORDER BY column_name;

-- Summary: Count columns in each table
SELECT 
  'invoices' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'invoices'

UNION ALL

SELECT 
  'loads' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'loads'

UNION ALL

SELECT 
  'routes' as table_name,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'routes';

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';

-- Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_route_linestring',
    'calculate_realtime_eta',
    'update_route_eta',
    'trigger_create_route_linestring'
  )
ORDER BY routine_name;


