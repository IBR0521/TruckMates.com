# IFTA Database Fixes

## Issues Found

1. **Missing `ifta_tax_rates` table** - Error: "Could not find the table 'public.ifta_tax_rates' in the schema cache"
2. **Missing `net_tax_due` column in `ifta_reports` table** - Error: "Could not find the 'net_tax_due' column of 'ifta_reports' in the schema cache"
3. **RLS Policy Error** - Error: "new row violates row-level security policy for table 'ifta_reports'"

## Solutions

### 1. Create IFTA Tax Rates Table

**File:** `supabase/create_ifta_tax_rates_table.sql`

Run this migration in your Supabase SQL Editor to create the `ifta_tax_rates` table with:
- Table structure for quarterly tax rate management
- Indexes for performance
- SQL functions for rate lookups
- Row Level Security (RLS) policies
- Permissions for authenticated users

### 2. Add Missing Columns to IFTA Reports Table

**File:** `supabase/add_ifta_reports_columns.sql`

Run this migration in your Supabase SQL Editor to add missing columns to the `ifta_reports` table:
- `net_tax_due` - Net tax due (total_tax_due - total_tax_paid)
- `total_tax_due` - Total tax due (migrated from `tax_owed` if exists)
- `total_tax_paid` - Total tax paid
- `total_gallons` - Total gallons (migrated from `fuel_purchased` if exists)
- `submitted_at` - Timestamp when report was submitted
- `approved_at` - Timestamp when report was approved

The migration:
- Safely adds columns only if they don't exist
- Migrates data from old column names if they exist
- Calculates `net_tax_due` from existing data
- Creates indexes for performance

### 3. Fix RLS Policies for IFTA Reports

**File:** `supabase/fix_ifta_reports_rls.sql`

Run this migration to fix the Row Level Security policies. The issue was that the existing policy only allowed managers to create IFTA reports, but the application allows all authenticated users in a company to create reports.

This migration:
- Drops all existing conflicting policies
- Creates new policies that allow all users in a company to:
  - View IFTA reports
  - Insert (create) IFTA reports
  - Update IFTA reports
  - Delete IFTA reports
- Grants necessary permissions to authenticated users

## How to Apply

1. Open your Supabase Dashboard
2. Navigate to SQL Editor
3. Run migrations in this order:
   - `supabase/create_ifta_tax_rates_table.sql` (if not already run)
   - `supabase/add_ifta_reports_columns.sql` (if not already run)
   - `supabase/fix_ifta_reports_rls.sql` (this fixes the RLS error)
4. Refresh your application

## Notes

- All migrations use `IF NOT EXISTS` and `DROP POLICY IF EXISTS` checks, so they're safe to run multiple times
- The migrations preserve existing data
- Old column names (`tax_owed`, `fuel_purchased`) are kept for backward compatibility if they exist
- The RLS fix ensures all authenticated users in a company can create IFTA reports, not just managers

