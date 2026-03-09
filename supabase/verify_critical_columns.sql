-- ============================================================================
-- CRITICAL COLUMN VERIFICATION
-- ============================================================================
-- Run this to verify all critical columns we need exist
-- ============================================================================

-- 1. Verify Invoice Payment Columns (Should return 11 rows)
SELECT 
  'invoices' as table_name,
  column_name,
  data_type,
  '✅ CRITICAL' as status
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

-- 2. Verify Loads Critical Columns (Should return 12 rows)
SELECT 
  'loads' as table_name,
  column_name,
  data_type,
  '✅ CRITICAL' as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'loads'
  AND column_name IN (
    'priority', 
    'status_color', 
    'urgency_score', 
    'company_name',
    'source', 
    'delivery_type', 
    'load_type', 
    'customer_id',
    'total_rate', 
    'estimated_revenue', 
    'shipper_name', 
    'consignee_name'
  )
ORDER BY column_name;

-- 3. Verify Routes Critical Columns (Should return 7 rows)
SELECT 
  'routes' as table_name,
  column_name,
  data_type,
  '✅ CRITICAL' as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'routes'
  AND column_name IN (
    'depot_name', 
    'route_linestring', 
    'current_eta',
    'last_eta_update', 
    'eta_confidence', 
    'route_type', 
    'scenario'
  )
ORDER BY column_name;

-- 4. Verify Trigger Exists
SELECT 
  'trigger' as check_type,
  trigger_name,
  event_object_table,
  '✅ EXISTS' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';

-- 5. Summary Count
SELECT 
  'SUMMARY' as check_type,
  'invoices_critical_columns' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 11 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'invoices'
  AND column_name IN ('notes', 'paid_amount', 'paid_date', 'payment_method', 'tax_amount', 'tax_rate', 'subtotal', 'customer_id', 'stripe_payment_intent_id', 'paypal_order_id', 'stripe_invoice_id')

UNION ALL

SELECT 
  'SUMMARY' as check_type,
  'loads_critical_columns' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 12 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'loads'
  AND column_name IN ('priority', 'status_color', 'urgency_score', 'company_name', 'source', 'delivery_type', 'load_type', 'customer_id', 'total_rate', 'estimated_revenue', 'shipper_name', 'consignee_name')

UNION ALL

SELECT 
  'SUMMARY' as check_type,
  'routes_critical_columns' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 7 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'routes'
  AND column_name IN ('depot_name', 'route_linestring', 'current_eta', 'last_eta_update', 'eta_confidence', 'route_type', 'scenario')

UNION ALL

SELECT 
  'SUMMARY' as check_type,
  'trigger_exists' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';


