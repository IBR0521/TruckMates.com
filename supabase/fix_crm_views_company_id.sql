-- ============================================================================
-- Quick Fix: Add company_id to CRM Performance Views
-- ============================================================================
-- Run this in Supabase SQL Editor to fix the "column company_id does not exist" error
-- ============================================================================

-- Drop existing views first
DROP VIEW IF EXISTS public.crm_customer_performance CASCADE;
DROP VIEW IF EXISTS public.crm_vendor_performance CASCADE;

-- Customer Performance Metrics View (with company_id)
CREATE VIEW public.crm_customer_performance AS
SELECT 
  c.company_id,
  c.id as customer_id,
  c.name,
  c.company_name,
  c.relationship_type,
  c.status,
  c.payment_terms,
  
  -- Load Metrics
  COUNT(DISTINCT l.id) as total_loads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered') as completed_loads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered' AND l.actual_delivery <= COALESCE(l.estimated_delivery, l.actual_delivery)) as on_time_deliveries,
  CASE 
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered') > 0 
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered' AND l.actual_delivery <= COALESCE(l.estimated_delivery, l.actual_delivery))::DECIMAL / 
       COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'delivered')) * 100, 
      2
    )
    ELSE 0
  END as on_time_rate,
  
  -- Financial Metrics
  COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) as total_revenue,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'sent'), 0) as pending_revenue,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') as paid_invoices,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'sent') as pending_invoices,
  
  -- Payment Performance
  CASE 
    WHEN COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') > 0
    THEN ROUND(
      AVG(EXTRACT(EPOCH FROM (
        COALESCE(i.updated_at, i.due_date::timestamp with time zone) - i.issue_date::timestamp with time zone
      )) / 86400) 
      FILTER (WHERE i.status = 'paid'), 
      1
    )
    ELSE NULL
  END as avg_payment_days,
  
  -- Activity Metrics
  MAX(l.load_date) as last_load_date,
  MAX(i.created_at) as last_invoice_date,
  
  -- Profitability Score
  CASE 
    WHEN COUNT(DISTINCT l.id) > 0 AND COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') > 0
    THEN ROUND(
      (COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) / COUNT(DISTINCT l.id))::DECIMAL,
      2
    )
    ELSE 0
  END as revenue_per_load
  
FROM public.customers c
LEFT JOIN public.loads l ON l.customer_id = c.id
LEFT JOIN public.invoices i ON (
  (i.customer_id IS NOT NULL AND i.customer_id = c.id)
  OR (i.customer_name IS NOT NULL AND i.customer_name = c.name)
  OR (i.customer_name IS NOT NULL AND c.company_name IS NOT NULL AND i.customer_name = c.company_name)
)
GROUP BY c.company_id, c.id, c.name, c.company_name, c.relationship_type, c.status, c.payment_terms;

-- Vendor Performance Metrics View (with company_id)
CREATE VIEW public.crm_vendor_performance AS
SELECT 
  v.company_id,
  v.id as vendor_id,
  v.name,
  v.company_name,
  v.relationship_type,
  v.status,
  
  -- Transaction Metrics
  COUNT(DISTINCT e.id) as total_expenses,
  COALESCE(SUM(e.amount), 0) as total_spent,
  AVG(e.amount) as avg_expense_amount,
  
  -- Activity Metrics
  MAX(e.date) as last_transaction_date,
  MIN(e.date) as first_transaction_date,
  
  -- Reliability Score (based on expense frequency)
  CASE 
    WHEN MAX(e.date) IS NOT NULL AND MIN(e.date) IS NOT NULL
    THEN ROUND(
      COUNT(DISTINCT e.id)::DECIMAL / 
      GREATEST((MAX(e.date) - MIN(e.date))::DECIMAL / 30.0, 1),
      2
    )
    ELSE 0
  END as transactions_per_month
  
FROM public.vendors v
LEFT JOIN public.expenses e ON e.vendor = v.name OR e.vendor_id = v.id
GROUP BY v.company_id, v.id, v.name, v.company_name, v.relationship_type, v.status;

