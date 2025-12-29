# CRM Schema Setup - Simple Guide

## ✅ **Use These 2 Files Only**

1. **`DROP_CRM_TABLES.sql`** - Run this FIRST (cleans up old tables)
2. **`supabase/crm_schema_complete.sql`** - Run this SECOND (creates everything)

## 🚀 **Quick Setup**

1. Copy and paste `DROP_CRM_TABLES.sql` into Supabase SQL Editor → Click "Run"
2. Copy and paste `supabase/crm_schema_complete.sql` into Supabase SQL Editor → Click "Run"

That's it! Your CRM schema is now set up.

## 📋 **What Gets Created**

- ✅ 4 tables: customers, vendors, contacts, contact_history
- ✅ All indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Triggers for automatic updates
- ✅ Helper functions

## ⚠️ **Requirements**

- Make sure you've run the base `supabase/schema.sql` first (creates the `companies` table)
- The CRM schema depends on the `companies` table existing

