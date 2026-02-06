-- ============================================================================
-- Enhanced Maintenance Features - Migration Script
-- ============================================================================
-- Run this script in Supabase SQL Editor to enable all enhanced maintenance features
-- ============================================================================
-- IMPORTANT: Run these migrations in order!
-- ============================================================================

-- Step 1: ELD Fault Code Analysis
-- This adds fault code tracking and automatic maintenance creation
\i supabase/eld_fault_code_maintenance.sql

-- Step 2: Work Orders System
-- This creates the work orders table and functions
\i supabase/work_orders_schema.sql

-- Step 3: Maintenance Document Storage
-- This adds document storage for maintenance records
\i supabase/maintenance_documents_schema.sql

-- Step 4: Parts Inventory Integration
-- This integrates parts inventory with maintenance workflow
\i supabase/maintenance_parts_integration.sql

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if fault code columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'eld_events' 
  AND column_name IN ('fault_code', 'fault_code_category', 'maintenance_created');

-- Check if fault_code_maintenance_rules table exists
SELECT COUNT(*) as rule_count 
FROM information_schema.tables 
WHERE table_name = 'fault_code_maintenance_rules';

-- Check if work_orders table exists
SELECT COUNT(*) as work_order_count 
FROM information_schema.tables 
WHERE table_name = 'work_orders';

-- Check if maintenance_documents table exists
SELECT COUNT(*) as doc_count 
FROM information_schema.tables 
WHERE table_name = 'maintenance_documents';

-- Check if maintenance table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'maintenance' 
  AND column_name IN ('documents', 'parts_used');

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- 1. eld_events should have: fault_code, fault_code_category, maintenance_created, maintenance_id
-- 2. fault_code_maintenance_rules table should exist
-- 3. work_orders table should exist
-- 4. maintenance_documents table should exist
-- 5. maintenance table should have: documents, parts_used columns
-- ============================================================================


