# RLS Performance Fix Migration

## Overview

This migration fixes two types of Supabase database linter warnings:

1. **auth_rls_initplan**: RLS policies that re-evaluate `auth.uid()` for each row instead of once per query
2. **multiple_permissive_policies**: Multiple permissive policies for the same role/action on the same table

## Files

- `fix_rls_performance.sql` - Main migration for core tables
- `fix_rls_performance_part2.sql` - Additional migration for extended tables

## How to Apply

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the migrations in order:**
   ```sql
   -- First, run fix_rls_performance.sql
   -- Then, run fix_rls_performance_part2.sql
   ```

3. **Verify the fixes:**
   - Go to Database → Linter in Supabase dashboard
   - Check that the warnings are resolved

## What These Migrations Do

### 1. Helper Functions

Creates two helper functions that evaluate `auth.uid()` once per query:
- `get_user_company_id()` - Returns the current user's company_id
- `is_user_manager()` - Returns true if the current user is a manager

### 2. Policy Updates

For each table, the migrations:
- Drop existing policies
- Recreate policies using `(select auth.uid())` or helper functions
- Consolidate multiple permissive policies into single policies where possible

### 3. Performance Improvements

**Before:**
```sql
USING (
  company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  )
)
```

**After:**
```sql
USING (company_id = (select get_user_company_id()))
```

## Tables Fixed

### Core Tables (fix_rls_performance.sql)
- companies
- users
- drivers
- trucks
- routes
- loads
- invoices
- expenses
- settlements
- maintenance
- ifta_reports
- documents
- customers
- vendors
- contacts
- notifications
- alert_rules
- alerts
- reminders
- company_settings
- company_integrations
- company_billing_info
- company_portal_settings
- company_reminder_settings
- subscriptions
- payment_methods
- filter_presets
- audit_logs

### Extended Tables (fix_rls_performance_part2.sql)
- eld_devices, eld_logs, eld_locations, eld_events, eld_driver_mappings
- dvir
- geofences
- zone_visits
- eta_updates
- route_stops
- load_delivery_points
- address_book
- contact_history
- notification_preferences
- work_orders
- maintenance_documents
- parts, part_usage, part_orders
- fault_code_maintenance_rules
- bol_templates, bols
- driver_pay_rules
- fuel_purchases
- ifta_state_breakdown
- state_crossings
- check_calls
- chat_threads, chat_messages
- customer_portal_access
- user_preferences
- driver_onboarding
- onboarding_checklist_templates
- feedback
- webhooks, webhook_deliveries
- api_usage_log, api_cache
- ai_knowledge_base, ai_conversations
- idle_time_sessions
- detention_tracking
- load_status_history
- invoice_verifications
- maintenance_alert_notifications

## Expected Results

After running these migrations:
- ✅ All `auth_rls_initplan` warnings should be resolved
- ✅ Most `multiple_permissive_policies` warnings should be resolved
- ✅ Query performance should improve significantly at scale
- ✅ RLS policies will evaluate `auth.uid()` once per query instead of per row

## Notes

- These migrations are **safe to run multiple times** (they use `DROP POLICY IF EXISTS`)
- The helper functions are created with `SECURITY DEFINER` to bypass RLS when checking user info
- Some tables may still have multiple policies if they serve different purposes (e.g., public token access vs authenticated access)

## Troubleshooting

If you encounter errors:
1. Check that all tables exist in your database
2. Verify that RLS is enabled on the tables
3. Make sure you have the necessary permissions to create/drop policies
4. Run migrations one at a time to identify any specific table issues










