# CRM Schema Setup Instructions

## ⚠️ Important: Setup Steps

To set up the CRM schema correctly, follow these steps **in order**:

### Step 1: Drop Existing Tables (If Any)
1. Open `DROP_CRM_TABLES.sql` in your project
2. Copy ALL contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. This will clean up any existing CRM tables

### Step 2: Run the Complete CRM Schema (RECOMMENDED)
**Use the complete version that includes the function:**
1. Open `CRM_SCHEMA_WITH_FUNCTION.sql` in your project (I just created this)
2. Copy ALL contents
3. Paste into Supabase SQL Editor (new query)
4. Click "Run"
5. This will create all CRM tables with all required functions

**OR use the regular version:**
1. Open `supabase/crm_schema.sql` in your project
2. Copy ALL contents
3. Paste into Supabase SQL Editor (new query)
4. Click "Run"

### Step 3: Verify Setup
Run this query to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customers', 'vendors', 'contacts', 'contact_history');
```

You should see all 4 tables listed.

---

## ✅ That's It!

After running both SQL files in order, your CRM schema will be set up correctly with:
- ✅ Customers table
- ✅ Vendors table  
- ✅ Contacts table
- ✅ Contact History table
- ✅ All indexes
- ✅ All RLS policies
- ✅ All triggers and functions

---

## 📝 Notes

- The schema has been rewritten from scratch and is clean
- All columns are properly defined
- No more missing column errors!
- The schema will work perfectly for fresh installations

