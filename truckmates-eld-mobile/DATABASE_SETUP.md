# Database Setup for Mobile ELD App

The mobile app uses the **same Supabase database** as your TruckMates platform. You need to ensure the ELD tables exist and have the correct permissions.

## Quick Setup

### Step 1: Check if ELD Tables Exist

Go to your Supabase dashboard → **Table Editor** and check if these tables exist:
- ✅ `eld_devices`
- ✅ `eld_logs`
- ✅ `eld_locations`
- ✅ `eld_events`

### Step 2: Run ELD Schema (If Tables Don't Exist)

If the tables don't exist yet:

1. Go to Supabase dashboard → **SQL Editor**
2. Open `supabase/eld_schema.sql` from your TruckMates platform codebase
3. Copy and paste the entire SQL into the SQL Editor
4. Click **Run**
5. Wait for success message

### Step 3: Update RLS Policies for Mobile App

**IMPORTANT:** The mobile app needs special permissions to insert data. Run this migration:

1. Go to Supabase dashboard → **SQL Editor**
2. Open `supabase/eld_mobile_app_policies.sql` from your TruckMates platform codebase
3. Copy and paste the entire SQL into the SQL Editor
4. Click **Run**
5. Wait for success message

This migration will:
- Allow drivers to register mobile devices (`provider = 'truckmates_mobile'`)
- Allow authenticated users to insert logs, locations, and events
- Keep existing manager permissions for other ELD providers

## What Gets Created

### Tables

1. **`eld_devices`** - Stores ELD device information
   - Mobile app devices have `provider = 'truckmates_mobile'`
   - Each device has a unique `device_serial_number`

2. **`eld_logs`** - Stores HOS (Hours of Service) logs
   - Driving, on-duty, off-duty, sleeper berth entries
   - Linked to device and driver

3. **`eld_locations`** - Stores GPS location data
   - Real-time location updates from mobile app
   - Speed, heading, odometer readings

4. **`eld_events`** - Stores events and violations
   - HOS violations
   - Speeding, hard braking, etc.
   - Device malfunctions

### Indexes

Performance indexes are created on:
- `company_id` (all tables)
- `eld_device_id` (logs, locations, events)
- `driver_id`, `truck_id` (where applicable)
- `timestamp`, `log_date` (for time-based queries)

### Row Level Security (RLS)

- ✅ Users can only see data from their company
- ✅ Drivers can insert data via mobile app
- ✅ Managers can manage all ELD devices
- ✅ All data is company-scoped

## Verification

After running the migrations, verify:

1. **Tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'eld_%';
   ```

2. **Policies exist:**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE tablename LIKE 'eld_%';
   ```

3. **Test insert (replace with your user ID):**
   ```sql
   -- This should work if you're authenticated
   INSERT INTO eld_devices (company_id, device_name, device_serial_number, provider)
   VALUES (
     (SELECT company_id FROM users WHERE id = auth.uid()),
     'Test Device',
     'TEST-' || gen_random_uuid()::text,
     'truckmates_mobile'
   );
   ```

## Troubleshooting

### Error: "permission denied for table eld_devices"

**Solution:** Run the `eld_mobile_app_policies.sql` migration to add insert permissions.

### Error: "relation does not exist"

**Solution:** Run the `eld_schema.sql` file to create the tables.

### Error: "foreign key constraint violation"

**Solution:** Make sure you have:
- A `company_id` in the `users` table
- A valid `company_id` in the `companies` table

### Mobile app can't insert data

**Solution:** 
1. Check that RLS policies allow inserts (run `eld_mobile_app_policies.sql`)
2. Verify user is authenticated (has valid Supabase session)
3. Verify user has a `company_id` in the `users` table

## No Separate Database Needed!

The mobile app uses the **same database** as your TruckMates platform:
- Same authentication system
- Same company structure
- Same data model
- Seamless integration

All mobile app data appears in your platform's ELD pages automatically!

---

**Next Steps:**
1. Run the SQL migrations in Supabase
2. Update `.env` file with Supabase credentials
3. Test the mobile app registration

