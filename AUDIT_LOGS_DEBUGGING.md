# Audit Logs Debugging Guide

## Issue: History Not Showing Changes

Follow these steps to debug:

### Step 1: Check if Audit Logs Are Being Created

1. Open browser console (F12)
2. Edit a driver field (name, status, phone, etc.)
3. Look for these messages:
   - ✅ `[AUDIT LOG] ✅ Successfully created audit log:` = Logs ARE being created
   - ❌ `[AUDIT LOG] ⚠️ audit_logs table does not exist!` = Table missing
   - ❌ `[AUDIT LOG] ⚠️ RLS policy blocking insert!` = INSERT policy missing
   - ❌ `[updateDriver] ❌ Audit log failed` = Something is wrong

### Step 2: Check Database Directly

Run this SQL in Supabase to see if logs exist:

```sql
-- Check all audit logs
SELECT 
  id,
  action,
  resource_type,
  resource_id,
  details->>'field' as field,
  details->>'old_value' as old_value,
  details->>'new_value' as new_value,
  created_at,
  user_id
FROM audit_logs
WHERE resource_type = 'driver'
ORDER BY created_at DESC
LIMIT 10;
```

If this returns 0 rows, logs aren't being created.

### Step 3: Check API Endpoint

1. Open browser console
2. Click History icon
3. Look for:
   - `[AuditTrail] Loading logs for:` = Component is trying to load
   - `[Audit Logs API] Found X logs` = API found logs
   - `[AuditTrail] Received logs: X entries` = Component received logs

### Step 4: Check RLS Policies

Run this SQL to check policies:

```sql
-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'audit_logs';
```

You should see:
- One SELECT policy
- One INSERT policy

### Step 5: Test INSERT Directly

Run this SQL (replace with your actual values):

```sql
-- Test insert (replace values with your actual data)
INSERT INTO audit_logs (
  company_id,
  user_id,
  action,
  resource_type,
  resource_id,
  details
) VALUES (
  'YOUR_COMPANY_ID'::uuid,
  'YOUR_USER_ID'::uuid,
  'data.updated',
  'driver',
  'YOUR_DRIVER_ID'::uuid,
  '{"field": "name", "old_value": "Old Name", "new_value": "New Name"}'::jsonb
);
```

If this fails, there's an RLS policy issue.

## Common Issues

### Issue 1: Logs Created But Not Showing
- **Symptom**: Console shows `✅ Successfully created audit log` but History shows nothing
- **Fix**: Check if `resource_id` matches exactly (case-sensitive UUID)
- **Check**: Run SQL query from Step 2 to verify logs exist

### Issue 2: RLS Blocking SELECT
- **Symptom**: API returns error or empty array
- **Fix**: Verify SELECT policy allows your user's company_id
- **Check**: Run SQL from Step 4

### Issue 3: Wrong resource_id Format
- **Symptom**: Logs exist but for different resource_id
- **Fix**: Check that `driver.id` is a valid UUID string
- **Debug**: Add `console.log("Driver ID:", driver.id)` in drivers page

## Quick Test Script

Run this in browser console after editing a driver:

```javascript
// Test audit logs API
fetch('/api/audit-logs?resource_type=driver&resource_id=YOUR_DRIVER_ID')
  .then(r => r.json())
  .then(data => {
    console.log("Audit logs:", data);
    console.log("Count:", data.logs?.length || 0);
  });
```

Replace `YOUR_DRIVER_ID` with an actual driver ID from your database.


