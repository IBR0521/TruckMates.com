# ELD Database Setup - What You Need to Do

## 🗄️ Database Setup Required

**YES, you need to run the database migration** to create the ELD tables. Here's what you need to do:

---

## 📋 Step-by-Step Database Setup

### Step 1: Go to Supabase Dashboard

1. Log in to your **Supabase Dashboard**
2. Select your project
3. Go to **SQL Editor** (left sidebar)

### Step 2: Run the Migration Script

1. Open the file: **`supabase/eld_schema.sql`**
2. Copy the **entire contents** of the file
3. Paste into Supabase SQL Editor
4. Click **"Run"** button (or press Ctrl+Enter)

### Step 3: Verify Tables Created

After running, verify these tables were created:

- ✅ `eld_devices` - Stores ELD device information
- ✅ `eld_logs` - Stores HOS (Hours of Service) logs
- ✅ `eld_locations` - Stores GPS location data
- ✅ `eld_events` - Stores events and violations

### Step 4: Check RLS Policies

Verify Row Level Security (RLS) policies were created:
- ✅ Policies for `eld_devices`
- ✅ Policies for `eld_logs`
- ✅ Policies for `eld_locations`
- ✅ Policies for `eld_events`

---

## 📝 What the Migration Creates

### Tables Created:

1. **`eld_devices`**
   - Device information
   - API credentials
   - Provider details
   - Status tracking

2. **`eld_logs`**
   - Hours of Service data
   - Driving time
   - Location data
   - Miles driven

3. **`eld_locations`**
   - GPS coordinates
   - Speed data
   - Timestamps
   - Engine status

4. **`eld_events`**
   - Violations
   - Alerts
   - Safety events
   - Device malfunctions

### Indexes Created:

- Performance indexes on all tables
- Faster queries
- Better performance

### RLS Policies Created:

- Users can only see their company's data
- Managers can manage devices
- System can insert data
- Secure access control

---

## ✅ Quick Setup Checklist

### Database Setup:

- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Open `supabase/eld_schema.sql`
- [ ] Copy entire file
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify tables created
- [ ] Verify RLS policies created

### After Database Setup:

- [ ] Tables exist ✅
- [ ] RLS policies active ✅
- [ ] Ready for users to add devices ✅

---

## 🧪 Verify Database Setup

### Check 1: Verify Tables Exist

Run this in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'eld_%';
```

Should return:
- `eld_devices`
- `eld_logs`
- `eld_locations`
- `eld_events`

### Check 2: Verify RLS is Enabled

Run this:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'eld_%';
```

All should show `rowsecurity = true`

### Check 3: Verify Policies Exist

Run this:

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'eld_%';
```

Should show multiple policies for each table.

---

## ⚠️ Important Notes

### 1. Run Migration Once

- Only need to run `eld_schema.sql` **once**
- Safe to run multiple times (uses `IF NOT EXISTS`)
- Won't duplicate tables

### 2. Production vs Development

- Run in **both** development and production databases
- If using separate Supabase projects, run in both

### 3. Backup First (Recommended)

- Backup your database before running migration
- Supabase has automatic backups, but good practice

---

## 🚨 If Migration Fails

### Common Issues:

1. **"Table already exists"**
   - Tables might already be created
   - Check if tables exist first
   - Safe to ignore if using `IF NOT EXISTS`

2. **"Permission denied"**
   - Make sure you're logged in as project owner
   - Check you have SQL Editor access

3. **"Function not found"**
   - Some functions might need to be created first
   - Check if `update_eld_updated_at_column` function exists

### Solution:

If migration fails, check error message:
- Most errors are safe to ignore if tables already exist
- Re-run specific parts if needed
- Contact Supabase support if persistent issues

---

## 📊 Database Schema Overview

### Table Relationships:

```
companies
    ↓
eld_devices (company_id)
    ↓
eld_logs (eld_device_id)
eld_locations (eld_device_id)
eld_events (eld_device_id)
    ↓
trucks (truck_id)
drivers (driver_id)
```

### Data Flow:

```
User adds device
    ↓
Stored in eld_devices
    ↓
Sync runs
    ↓
Data stored in:
    - eld_logs
    - eld_locations
    - eld_events
    ↓
Displayed in dashboard
```

---

## 🎯 Summary

### What You Need to Do:

1. ✅ **Run database migration** (`supabase/eld_schema.sql`)
2. ✅ **Verify tables created**
3. ✅ **That's it!**

### What Gets Created:

- ✅ 4 new tables
- ✅ Indexes for performance
- ✅ RLS policies for security
- ✅ Triggers for timestamps

### After Setup:

- ✅ Users can add devices
- ✅ System can store ELD data
- ✅ Everything works automatically

---

## 🚀 Quick Start

**Fastest way to set up database:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/eld_schema.sql`
3. Paste and click "Run"
4. Done! ✅

**Total time: ~2 minutes**

---

**Once you run the migration, the database is ready and users can start adding ELD devices!** 🎉

