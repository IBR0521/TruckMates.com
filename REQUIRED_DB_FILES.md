# Required Database Files - Quick Reference

## 🎯 Minimum Required Files to Run

You need to run these **2 files** in Supabase SQL Editor:

### 1. CRM Schema ⭐
**File:** `supabase/crm_schema.sql`
- Creates: customers, vendors, contacts, contact_history tables
- Enables: Customer & Vendor Management features

### 2. BOL Schema ⭐
**File:** `supabase/bol_schema.sql`
- Creates: bills_of_lading table
- Enables: Bill of Lading features

---

## 📋 Execution Order

1. **First:** Run `supabase/crm_schema.sql`
2. **Second:** Run `supabase/bol_schema.sql`

---

## 📝 Note

If you haven't set up your base database yet, also run:
- `supabase/schema.sql` (run this FIRST before the others)

---

## 📂 File Locations

All files are in the `supabase/` folder in your project root.


