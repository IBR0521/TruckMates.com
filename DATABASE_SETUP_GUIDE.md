# Database Setup Guide

## 📋 Required Database Schemas

To get the platform fully functional, you need to run these SQL files in your Supabase SQL Editor **in this order**:

### 1. Base Schema (If Not Already Run)
**File:** `supabase/schema.sql`
- This is the main base schema for the platform
- Includes: users, companies, drivers, trucks, routes, loads, invoices, expenses, settlements, maintenance, IFTA reports, documents
- **Run this FIRST** if you haven't already set up your database

### 2. CRM Schema ⭐ REQUIRED
**File:** `supabase/crm_schema.sql`
- Creates Customer & Vendor Management tables
- Tables: `customers`, `vendors`, `contacts`, `contact_history`
- Adds foreign key relationships to existing tables
- Includes RLS policies and indexes
- **Run this to enable CRM features**

### 3. BOL Schema ⭐ REQUIRED
**File:** `supabase/bol_schema.sql`
- Creates Bill of Lading system
- Table: `bills_of_lading`
- Includes RLS policies and indexes
- **Run this to enable BOL features**

### 4. Extended CRM Schema (Optional - Only if needed)
**File:** `supabase/crm_schema_extended.sql`
- Adds additional fields to customers/vendors tables
- Only needed if the base CRM schema doesn't have all fields
- Check your schema first - if fields like `company_name`, `website`, `tax_id`, etc. already exist, skip this

---

## 🚀 Quick Setup Steps

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Run Schemas (In Order)

#### Option A: If Database is Fresh (No Existing Schema)
```sql
-- 1. Run base schema first
-- Copy and paste contents of: supabase/schema.sql

-- 2. Then run CRM schema
-- Copy and paste contents of: supabase/crm_schema.sql

-- 3. Then run BOL schema
-- Copy and paste contents of: supabase/bol_schema.sql
```

#### Option B: If You Already Have Base Schema
```sql
-- 1. Run CRM schema
-- Copy and paste contents of: supabase/crm_schema.sql

-- 2. Run BOL schema
-- Copy and paste contents of: supabase/bol_schema.sql
```

### Step 3: Verify Setup
After running the schemas, verify tables were created:

```sql
-- Check if CRM tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customers', 'vendors', 'contacts', 'contact_history');

-- Check if BOL table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'bills_of_lading';
```

---

## 📁 Schema Files Location

All schema files are located in the `supabase/` directory:

```
supabase/
├── schema.sql                    # Base schema (main platform)
├── crm_schema.sql               # ⭐ CRM (Customers & Vendors)
├── bol_schema.sql               # ⭐ BOL (Bill of Lading)
├── crm_schema_extended.sql      # Optional extended fields
├── eld_schema.sql               # ELD device schema (if using ELD)
└── ... (other schema files)
```

---

## ✅ After Running Schemas

Once you've run the required schemas:

1. ✅ CRM features will be available (Customers, Vendors pages)
2. ✅ BOL features will be available (Bill of Lading pages)
3. ✅ All navigation links will work
4. ✅ All server actions will function correctly

---

## 🔍 Troubleshooting

### If you get errors about existing tables:
- The `CREATE TABLE IF NOT EXISTS` statements should prevent this
- If you see "relation already exists" errors, the tables are already created - that's fine!

### If you get RLS policy errors:
- Make sure you're running as the database owner or have proper permissions
- Policies should be created automatically by the schema files

### If fields are missing:
- Check if you need to run `crm_schema_extended.sql` (though `crm_schema.sql` should have all fields)
- Verify the schema by checking the table structure in Supabase

---

## 📝 Required Files Summary

**Minimum Required:**
1. ✅ `supabase/crm_schema.sql` - For CRM features
2. ✅ `supabase/bol_schema.sql` - For BOL features

**Also Required (if not already run):**
3. ✅ `supabase/schema.sql` - Base platform schema

**Optional:**
4. `supabase/crm_schema_extended.sql` - Only if base CRM schema is missing fields

---

## 🎯 Quick Checklist

- [ ] Run `supabase/schema.sql` (if not already done)
- [ ] Run `supabase/crm_schema.sql`
- [ ] Run `supabase/bol_schema.sql`
- [ ] Verify tables were created
- [ ] Test CRM features (Customers/Vendors pages)
- [ ] Test BOL features (BOL pages)

---

**Ready to go!** After running these schemas, all features will be fully functional. 🚀


