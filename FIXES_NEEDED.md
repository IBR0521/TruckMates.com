# Critical Fixes Needed for Platform Testing

## ⚠️ Schema Mismatch Issues Found

### Issue 1: Customer Form Fields vs Database Schema

**Problem:**
- Customer add/edit forms use fields like `company_name`, `address_line1`, `address_line2`, `primary_contact_name`, `website`, `tax_id`, `payment_terms`, `credit_limit`, `currency`, `customer_type`, `status`, `priority`, `tags`
- But the actual database schema (`crm_schema.sql`) only has: `name`, `contact_person`, `email`, `phone`, `address`, `city`, `state`, `zip_code`, `notes`

**Fix Needed:**
1. Either update the database schema to include all the fields, OR
2. Update the forms and server actions to match the existing schema

**Recommended Fix:** Update the database schema to include all fields (better for functionality)

### Issue 2: Customer Detail Page Financial Summary

**Problem:**
- Customer detail page tries to access `customer.total_revenue`, `customer.total_loads`, `customer.last_load_date`
- These fields don't exist in the database
- Should calculate from related loads/invoices instead

**Fix Applied:** ✅ Updated to calculate from actual loads/invoices data

### Issue 3: Vendor Page Total Spent

**Problem:**
- Vendor list page shows `vendor.total_spent` and `vendor.total_transactions`
- These fields don't exist in the database

**Fix Applied:** ✅ Updated to show placeholder (needs expenses/maintenance integration)

## 🔧 Required Actions

### Option A: Update Database Schema (Recommended)

Add missing fields to `customers` and `vendors` tables:

```sql
-- Add to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30',
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'shipper',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_phone TEXT;

-- Update address to support line1/line2 or keep as single field
-- Option 1: Keep single address field (current)
-- Option 2: Split into address_line1 and address_line2
```

### Option B: Update Forms to Match Current Schema

Simplify customer/vendor forms to only include fields in current schema:
- Remove: company_name, website, tax_id, payment_terms, credit_limit, currency, customer_type, status, priority, tags, primary_contact_*
- Keep: name, contact_person (mapped from primary_contact_name), email, phone, address (single field), city, state, zip_code, notes

## 📝 Additional Fixes Applied

1. ✅ Fixed customer detail page financial summary to use actual data
2. ✅ Fixed vendor list to not show non-existent fields
3. ✅ Fixed customer loads query to handle missing fields gracefully
4. ✅ Fixed customer form field mapping in createCustomer (partial - needs schema update)

## 🚀 Next Steps

1. **Decide on schema approach** (Option A recommended for full functionality)
2. **Update database schema** if choosing Option A
3. **Update server actions** to match chosen schema
4. **Test all customer/vendor CRUD operations**
5. **Test BOL creation and management**
6. **Test route optimization**
7. **Test tracking page**


