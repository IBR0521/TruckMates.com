# Enhanced Maintenance SQL Migrations Guide

## 📋 Overview

Four new SQL migration files have been created to enable enhanced maintenance features. These must be run in **order** in the Supabase SQL Editor.

---

## 📁 Migration Files

### 1. `eld_fault_code_maintenance.sql`
**Purpose**: ELD fault code analysis and automatic maintenance creation

**What it does**:
- Adds `fault_code`, `fault_code_category`, `fault_code_description` columns to `eld_events`
- Adds `maintenance_created` and `maintenance_id` columns to `eld_events`
- Creates `fault_code_maintenance_rules` table
- Creates `analyze_fault_code_and_create_maintenance()` function
- Creates `batch_analyze_pending_fault_codes()` function
- Adds trigger to auto-analyze fault codes on event insert
- Inserts default OBD-II fault code rules

**Dependencies**: None (run first)

---

### 2. `work_orders_schema.sql`
**Purpose**: Work orders system for mechanics/vendors

**What it does**:
- Creates `work_orders` table
- Creates `generate_work_order_number()` function
- Creates `create_work_order_from_maintenance()` function
- Creates `check_and_reserve_parts()` function
- Creates `complete_work_order()` function
- Adds RLS policies

**Dependencies**: Requires `maintenance` table (already exists)

---

### 3. `maintenance_documents_schema.sql`
**Purpose**: Document storage for maintenance records

**What it does**:
- Adds `documents` JSONB column to `maintenance` table
- Creates `maintenance_documents` table
- Creates `sync_document_to_maintenance()` function
- Creates `remove_document_from_maintenance()` function
- Adds triggers for auto-sync
- Adds RLS policies

**Dependencies**: Requires `maintenance` table (already exists)

---

### 4. `maintenance_parts_integration.sql`
**Purpose**: Parts inventory integration with maintenance

**What it does**:
- Adds `parts_used` JSONB column to `maintenance` table
- Creates `record_parts_usage_from_work_order()` function
- Creates `check_low_stock_for_maintenance_parts()` function
- Creates `auto_create_part_orders_for_low_stock()` function
- Adds trigger on part usage

**Dependencies**: Requires `work_orders` table (from migration #2) and `parts` table (already exists)

---

## 🚀 How to Run

### Option 1: Run Individually (Recommended)

1. **Open Supabase Dashboard** → SQL Editor

2. **Run Migration 1**: Copy and paste contents of `supabase/eld_fault_code_maintenance.sql`
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for success message

3. **Run Migration 2**: Copy and paste contents of `supabase/work_orders_schema.sql`
   - Click "Run"
   - Wait for success message

4. **Run Migration 3**: Copy and paste contents of `supabase/maintenance_documents_schema.sql`
   - Click "Run"
   - Wait for success message

5. **Run Migration 4**: Copy and paste contents of `supabase/maintenance_parts_integration.sql`
   - Click "Run"
   - Wait for success message

### Option 2: Run All at Once

Copy all four files' contents into a single SQL editor window, separated by comments:

```sql
-- ============================================================================
-- Migration 1: ELD Fault Code Analysis
-- ============================================================================
[Contents of eld_fault_code_maintenance.sql]

-- ============================================================================
-- Migration 2: Work Orders System
-- ============================================================================
[Contents of work_orders_schema.sql]

-- ============================================================================
-- Migration 3: Maintenance Document Storage
-- ============================================================================
[Contents of maintenance_documents_schema.sql]

-- ============================================================================
-- Migration 4: Parts Inventory Integration
-- ============================================================================
[Contents of maintenance_parts_integration.sql]
```

---

## ✅ Verification

After running all migrations, verify they worked:

```sql
-- Check fault code columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'eld_events' 
  AND column_name IN ('fault_code', 'fault_code_category', 'maintenance_created');

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'fault_code_maintenance_rules',
  'work_orders',
  'maintenance_documents'
);

-- Check maintenance table columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'maintenance' 
  AND column_name IN ('documents', 'parts_used');

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'analyze_fault_code_and_create_maintenance',
  'create_work_order_from_maintenance',
  'check_and_reserve_parts',
  'complete_work_order'
);
```

**Expected Results**:
- ✅ `eld_events` should have 4 new columns
- ✅ 3 new tables should exist
- ✅ `maintenance` should have 2 new columns
- ✅ 4+ functions should exist

---

## ⚠️ Troubleshooting

### Error: "column already exists"
**Solution**: The migration uses `ADD COLUMN IF NOT EXISTS`, so this shouldn't happen. If it does, the column already exists - you can skip that part.

### Error: "table already exists"
**Solution**: The migration uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen. If it does, the table already exists - you can skip that part.

### Error: "function already exists"
**Solution**: The migration uses `CREATE OR REPLACE FUNCTION`, so it should replace existing functions. If you get this error, check if there's a syntax issue.

### Error: "permission denied"
**Solution**: Make sure you're running as a database admin or have the necessary permissions.

### Error: "relation does not exist"
**Solution**: Check if you're running migrations in the correct order. Some migrations depend on others.

---

## 🔄 Rollback (If Needed)

If you need to rollback, you can run:

```sql
-- Remove columns from eld_events
ALTER TABLE public.eld_events
  DROP COLUMN IF EXISTS fault_code,
  DROP COLUMN IF EXISTS fault_code_category,
  DROP COLUMN IF EXISTS fault_code_description,
  DROP COLUMN IF EXISTS maintenance_created,
  DROP COLUMN IF EXISTS maintenance_id;

-- Drop tables
DROP TABLE IF EXISTS public.fault_code_maintenance_rules CASCADE;
DROP TABLE IF EXISTS public.work_orders CASCADE;
DROP TABLE IF EXISTS public.maintenance_documents CASCADE;

-- Remove columns from maintenance
ALTER TABLE public.maintenance
  DROP COLUMN IF EXISTS documents,
  DROP COLUMN IF EXISTS parts_used;

-- Drop functions
DROP FUNCTION IF EXISTS analyze_fault_code_and_create_maintenance(UUID);
DROP FUNCTION IF EXISTS batch_analyze_pending_fault_codes(UUID, INTEGER);
DROP FUNCTION IF EXISTS create_work_order_from_maintenance(UUID);
DROP FUNCTION IF EXISTS check_and_reserve_parts(UUID);
DROP FUNCTION IF EXISTS complete_work_order(UUID, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS record_parts_usage_from_work_order(UUID);
DROP FUNCTION IF EXISTS check_low_stock_for_maintenance_parts(UUID);
DROP FUNCTION IF EXISTS auto_create_part_orders_for_low_stock(UUID, DECIMAL);
```

---

## 📊 What Gets Created

### Tables
- `fault_code_maintenance_rules` - Maps fault codes to maintenance types
- `work_orders` - Work orders for mechanics/vendors
- `maintenance_documents` - Document storage for maintenance

### Columns Added
- `eld_events`: `fault_code`, `fault_code_category`, `fault_code_description`, `maintenance_created`, `maintenance_id`
- `maintenance`: `documents`, `parts_used`

### Functions
- `analyze_fault_code_and_create_maintenance()` - Auto-create maintenance from fault codes
- `batch_analyze_pending_fault_codes()` - Batch process events
- `create_work_order_from_maintenance()` - Create work order
- `check_and_reserve_parts()` - Reserve parts
- `complete_work_order()` - Complete work order
- `record_parts_usage_from_work_order()` - Track parts usage
- `check_low_stock_for_maintenance_parts()` - Check low stock
- `auto_create_part_orders_for_low_stock()` - Auto-create orders

### Triggers
- `trigger_auto_analyze_fault_code` - Auto-analyze on event insert
- `trigger_sync_document_to_maintenance` - Sync documents
- `trigger_remove_document_from_maintenance` - Remove documents
- `trigger_check_low_stock_on_part_usage` - Check low stock

---

## ✅ After Running Migrations

1. **Test Fault Code Analysis**:
   ```sql
   -- Create a test ELD event with fault code
   INSERT INTO eld_events (company_id, eld_device_id, fault_code, fault_code_category, event_type, severity, title, event_time)
   VALUES ('your-company-id', 'your-device-id', 'P0300', 'engine', 'device_malfunction', 'high', 'Engine Misfire', NOW());
   
   -- Check if maintenance was auto-created
   SELECT * FROM maintenance WHERE notes LIKE '%P0300%';
   ```

2. **Test Work Order Creation**:
   ```sql
   -- Create work order from maintenance
   SELECT create_work_order_from_maintenance('maintenance-id');
   
   -- Check work order
   SELECT * FROM work_orders WHERE maintenance_id = 'maintenance-id';
   ```

3. **Verify Default Rules**:
   ```sql
   -- Check default fault code rules
   SELECT * FROM fault_code_maintenance_rules WHERE company_id IS NULL;
   ```

---

## 📝 Notes

- All migrations are **idempotent** (safe to run multiple times)
- Default fault code rules are inserted with `company_id = NULL` (available to all companies)
- Companies can create their own custom rules
- RLS policies are automatically applied
- All functions use `SECURITY DEFINER` where needed

---

## 🎯 Next Steps

After running migrations:

1. ✅ Deploy Edge Function: `supabase functions deploy analyze-eld-fault-codes`
2. ✅ Test the workflow with a real ELD event
3. ✅ Configure company-specific fault code rules
4. ✅ Set up scheduled Edge Function (optional)

---

**Status**: Ready to run! 🚀



