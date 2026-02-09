# Audit Logs Setup

## Issue: History Not Being Tracked

The audit logging feature is implemented but may not be working because the `audit_logs` table doesn't exist in your database.

## Solution

### Step 1: Create the Audit Logs Table

Run this SQL in your Supabase SQL Editor:

```sql
-- See: supabase/audit_logs_schema.sql
```

Or copy the contents of `supabase/audit_logs_schema.sql` and execute it.

### Step 2: Verify Table Creation

After running the migration, check if the table exists:

```sql
SELECT * FROM audit_logs LIMIT 1;
```

If you get an error, the table wasn't created. Check the SQL migration file for any errors.

### Step 3: Test Audit Logging

1. Edit a driver's name, status, or any field using inline edit
2. Check the browser console for any errors
3. If you see: `[AUDIT LOG] ⚠️ audit_logs table does not exist!` - the table needs to be created
4. If no errors, check the database:

```sql
SELECT * FROM audit_logs 
WHERE resource_type = 'driver' 
ORDER BY created_at DESC 
LIMIT 10;
```

## What Gets Logged

Every inline edit creates an audit log entry with:
- **Who**: User ID and name
- **What**: Field name (name, status, phone, email, etc.)
- **When**: Timestamp
- **Before**: Old value
- **After**: New value

## Viewing Audit Trail

Click the **History** icon (clock) next to any driver's Edit button to see the complete change history.

## Troubleshooting

### Error: "relation audit_logs does not exist"
- **Fix**: Run `supabase/audit_logs_schema.sql` in Supabase SQL Editor

### Error: "permission denied"
- **Fix**: Check RLS policies in the migration file

### No logs appearing
- Check browser console for errors
- Verify user is authenticated
- Check that `company_id` exists for the user

