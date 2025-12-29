# CRM Schema Files Summary

## 🎯 **USE THIS ONE FILE - IT HAS EVERYTHING!**

### `supabase/crm_schema_complete.sql`
**This is the ONLY file you need!** It includes everything:
- ✅ All tables (customers, vendors, contacts, contact_history)
- ✅ All indexes
- ✅ All RLS policies  
- ✅ All triggers and functions
- ✅ Everything in one clean file

**How to use:**
1. First, run `DROP_CRM_TABLES.sql` (to clean up if you have existing tables)
2. Then, run `supabase/crm_schema_complete.sql` (copy and paste into Supabase SQL Editor)

---

## 📝 **OTHER FILES (Legacy - Ignore These)**

The files below are old/legacy versions. Use `crm_schema_complete.sql` instead.

### ✅ **RECOMMENDED: Use These Files** (OLD - Use crm_schema_complete.sql instead)

### 1. `DROP_CRM_TABLES.sql` 
**Purpose:** Clean up existing CRM tables before creating new ones
**When to use:** Run this FIRST if you have existing CRM tables or are getting errors
**Status:** ✅ Fixed and ready to use

### 2. `supabase/crm_schema.sql`
**Purpose:** Main CRM schema file - creates customers, vendors, contacts, and contact_history tables
**When to use:** Run this AFTER dropping tables to create the CRM schema
**Status:** ✅ Fixed - includes UUID extension check, companies check, and function definition

### 3. `CRM_SCHEMA_WITH_FUNCTION.sql`
**Purpose:** Complete standalone CRM schema with everything included
**When to use:** Alternative to `supabase/crm_schema.sql` - this is a complete version with all dependencies
**Status:** ✅ Fixed - includes all checks and functions

---

## ⚠️ **ALTERNATIVE FILES (Can Use If Needed)**

### 4. `supabase/crm_schema_fixed.sql`
**Purpose:** Alternative version that uses `CREATE TABLE IF NOT EXISTS` (safer for existing tables)
**When to use:** If you want to run the schema multiple times without dropping first
**Status:** ✅ Fixed - now includes UUID extension check, companies check, and function definition
**Note:** This version uses `IF NOT EXISTS` which is safer but may not catch schema changes

---

## 📝 **MIGRATION/EXTENSION FILES**

### 5. `supabase/crm_schema_extended.sql`
**Purpose:** Adds additional columns to existing CRM tables (for backward compatibility)
**When to use:** Only if you already have CRM tables and need to add missing columns
**Status:** ✅ This is fine as-is (it's just ALTER TABLE statements)
**Note:** You probably don't need this if you're creating fresh tables

---

## 🗑️ **OLD/LEGACY FILES (Can Be Ignored)**

### 6. `FIX_CRM_SCHEMA.sql`
**Purpose:** Old fix script to add missing columns
**Status:** ❌ Legacy - no longer needed if you use the fixed schemas above

### 7. `FIX_CRM_SCHEMA_COMPLETE.sql`
**Purpose:** Old comprehensive fix script
**Status:** ❌ Legacy - no longer needed if you use the fixed schemas above

### 8. `TEST_CRM_SCHEMA.sql`
**Purpose:** Diagnostic script
**Status:** ⚠️ Keep for debugging if needed

### 9. `CHECK_VENDORS_ERROR.sql`
**Purpose:** Diagnostic script to check for vendor table errors
**Status:** ⚠️ Keep for debugging if needed

---

## 🚀 **RECOMMENDED SETUP PROCESS**

### Option A: Fresh Start (Recommended)
```sql
-- Step 1: Drop existing tables
-- Copy and paste DROP_CRM_TABLES.sql into Supabase SQL Editor

-- Step 2: Create fresh schema
-- Copy and paste supabase/crm_schema.sql into Supabase SQL Editor
```

### Option B: Safe Migration (If tables exist)
```sql
-- Step 1: Drop existing tables
-- Copy and paste DROP_CRM_TABLES.sql into Supabase SQL Editor

-- Step 2: Create schema (safer version)
-- Copy and paste supabase/crm_schema_fixed.sql into Supabase SQL Editor
```

### Option C: All-in-One
```sql
-- Step 1: Drop existing tables
-- Copy and paste DROP_CRM_TABLES.sql into Supabase SQL Editor

-- Step 2: Create complete schema
-- Copy and paste CRM_SCHEMA_WITH_FUNCTION.sql into Supabase SQL Editor
```

---

## ✅ **What Was Fixed**

All the main schema files now include:

1. ✅ UUID extension check (`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)
2. ✅ Companies table dependency check (ensures base schema is run first)
3. ✅ `update_updated_at_column()` function definition (before triggers use it)

This should resolve all the errors you were encountering!

