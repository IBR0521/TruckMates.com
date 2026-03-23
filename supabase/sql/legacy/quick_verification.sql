-- ============================================================================
-- QUICK VERIFICATION - Run this to check critical components
-- ============================================================================

-- 1. Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'route_linestring_trigger';

-- 2. Check critical invoice columns
SELECT 
  'invoices' as table_name,
  COUNT(*) as found_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'invoices'
  AND column_name IN (
    'notes', 'paid_amount', 'paid_date', 'payment_method', 
    'tax_amount', 'tax_rate', 'subtotal', 'customer_id',
    'stripe_payment_intent_id', 'paypal_order_id'
  );

-- 3. Check critical loads columns
SELECT 
  'loads' as table_name,
  COUNT(*) as found_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'loads'
  AND column_name IN (
    'priority', 'status_color', 'urgency_score', 'company_name',
    'source', 'delivery_type', 'load_type', 'customer_id',
    'total_rate', 'estimated_revenue'
  );

-- 4. Check critical routes columns
SELECT 
  'routes' as table_name,
  COUNT(*) as found_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'routes'
  AND column_name IN (
    'depot_name', 'route_linestring', 'current_eta',
    'last_eta_update', 'eta_confidence'
  );

-- 5. Total column counts
SELECT 
  'invoices' as table, COUNT(*) as total_columns FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices'
UNION ALL
SELECT 
  'loads' as table, COUNT(*) as total_columns FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loads'
UNION ALL
SELECT 
  'routes' as table, COUNT(*) as total_columns FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'routes';


