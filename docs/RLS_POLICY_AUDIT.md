# Row Level Security (RLS) Policy Audit

This document provides a comprehensive overview of all RLS policies in the TruckMates platform.

## Overview

Row Level Security (RLS) is enabled on all user-facing tables to ensure data isolation between companies. Each policy follows the pattern:
- Users can only access data from their own company
- Managers have additional permissions (create, update, delete)
- System operations (via service role) bypass RLS

## Policy Categories

### 1. Company Data Isolation
All policies ensure users can only access data from their `company_id`.

**Pattern:**
```sql
USING (
  company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  )
)
```

### 2. Manager Permissions
Managers (`super_admin`, `operations_manager`) can create, update, and delete records.

**Pattern:**
```sql
USING (
  company_id IN (
    SELECT company_id FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'operations_manager')
  )
)
```

## Tables with RLS Enabled

### Core Tables

#### `companies`
- **SELECT**: Users can view their own company
- **UPDATE**: Only managers can update company details

#### `users`
- **SELECT**: Users can view users from their company
- **INSERT**: Managers can add users to their company
- **UPDATE**: Managers can update users in their company
- **DELETE**: Only super_admin can delete users

#### `loads`
- **SELECT**: Users can view loads from their company
- **INSERT**: Managers and dispatchers can create loads
- **UPDATE**: Managers and dispatchers can update loads
- **DELETE**: Only managers can delete loads

#### `drivers`
- **SELECT**: Users can view drivers from their company
- **INSERT**: Managers can add drivers
- **UPDATE**: Managers can update drivers
- **DELETE**: Only managers can delete drivers

#### `trucks`
- **SELECT**: Users can view trucks from their company
- **INSERT**: Managers can add trucks
- **UPDATE**: Managers can update trucks
- **DELETE**: Only managers can delete trucks

#### `routes`
- **SELECT**: Users can view routes from their company
- **INSERT**: Managers and dispatchers can create routes
- **UPDATE**: Managers and dispatchers can update routes
- **DELETE**: Only managers can delete routes

### Financial Tables

#### `invoices`
- **SELECT**: Users can view invoices from their company
- **INSERT**: Managers and financial_controller can create invoices
- **UPDATE**: Managers and financial_controller can update invoices
- **DELETE**: Only managers can delete invoices

#### `expenses`
- **SELECT**: Users can view expenses from their company
- **INSERT**: Managers and financial_controller can create expenses
- **UPDATE**: Managers and financial_controller can update expenses
- **DELETE**: Only managers can delete expenses

#### `settlements`
- **SELECT**: Users can view settlements from their company
- **INSERT**: Managers and financial_controller can create settlements
- **UPDATE**: Managers and financial_controller can update settlements
- **DELETE**: Only managers can delete settlements

### ELD Tables

#### `eld_devices`
- **SELECT**: Users can view ELD devices from their company
- **INSERT**: Managers can add ELD devices
- **UPDATE**: Managers can update ELD devices
- **DELETE**: Only managers can delete ELD devices

#### `eld_logs`
- **SELECT**: Users can view ELD logs from their company
- **INSERT**: System only (via webhooks)
- **UPDATE**: System only
- **DELETE**: Only managers can delete logs

#### `eld_locations`
- **SELECT**: Users can view ELD locations from their company
- **INSERT**: System only (via webhooks)
- **UPDATE**: System only
- **DELETE**: Only managers can delete locations

### CRM Tables

#### `customers`
- **SELECT**: Users can view customers from their company
- **INSERT**: Managers can add customers
- **UPDATE**: Managers can update customers
- **DELETE**: Only managers can delete customers

#### `vendors`
- **SELECT**: Users can view vendors from their company
- **INSERT**: Managers can add vendors
- **UPDATE**: Managers can update vendors
- **DELETE**: Only managers can delete vendors

### Maintenance Tables

#### `maintenance`
- **SELECT**: Users can view maintenance records from their company
- **INSERT**: Managers can create maintenance records
- **UPDATE**: Managers can update maintenance records
- **DELETE**: Only managers can delete maintenance records

### Document Tables

#### `documents`
- **SELECT**: Users can view documents from their company
- **INSERT**: Users can upload documents to their company
- **UPDATE**: Users can update their own documents, managers can update any
- **DELETE**: Users can delete their own documents, managers can delete any

### Reporting Tables

#### `ifta_reports`
- **SELECT**: Users can view IFTA reports from their company
- **INSERT**: Managers and financial_controller can create reports
- **UPDATE**: Managers and financial_controller can update reports
- **DELETE**: Only managers can delete reports

### Subscription Tables

#### `subscriptions`
- **SELECT**: Users can view their company's subscription
- **INSERT**: Managers can create subscriptions
- **UPDATE**: Managers can update subscriptions
- **DELETE**: System only (via Stripe webhooks)

#### `api_keys`
- **SELECT**: Users can view their company's API keys
- **INSERT**: Only managers can create API keys
- **UPDATE**: Only managers can update API keys
- **DELETE**: Only managers can delete API keys

## Security Best Practices

### 1. Always Check Company ID
Every policy must verify `company_id` matches the user's company.

### 2. Role-Based Access
Use role checks for operations that require elevated permissions:
- `super_admin`: Full access
- `operations_manager`: Management operations
- `dispatcher`: Load and route management
- `financial_controller`: Financial operations
- `safety_compliance`: Safety and compliance operations
- `driver`: Read-only access to assigned resources

### 3. Service Role Bypass
System operations (webhooks, cron jobs) use `createAdminClient()` to bypass RLS.

### 4. Audit Logging
All sensitive operations should be logged in `audit_logs` table.

## Common Issues

### Issue: Policy Too Permissive
**Symptom**: Users can access data from other companies
**Fix**: Ensure `company_id` check is present in all policies

### Issue: Policy Too Restrictive
**Symptom**: Users cannot access their own data
**Fix**: Verify `auth.uid()` matches user ID in `users` table

### Issue: Performance Degradation
**Symptom**: Queries are slow
**Fix**: Ensure indexes exist on `company_id` columns

## Maintenance

### Adding New Tables
1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create SELECT policy for company isolation
3. Create INSERT/UPDATE/DELETE policies for managers
4. Add indexes on `company_id`

### Updating Policies
1. Test in development first
2. Use `DROP POLICY IF EXISTS` before creating new policy
3. Verify with test queries
4. Document changes in this file

## Testing RLS Policies

```sql
-- Test as regular user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-id-here';
SELECT * FROM loads; -- Should only see company's loads

-- Test as manager
SET ROLE authenticated;
SET request.jwt.claim.sub = 'manager-id-here';
SELECT * FROM loads; -- Should see company's loads
```

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

