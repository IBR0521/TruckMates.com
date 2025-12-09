# How to Add Subscription Database to Supabase

## 📋 Step-by-Step Instructions

### 1. Open Supabase Dashboard
- Go to [https://supabase.com](https://supabase.com)
- Sign in to your account
- Select your project

### 2. Open SQL Editor
- Click on **"SQL Editor"** in the left sidebar
- Click **"New query"** button

### 3. Copy and Paste the Schema
- Open the file: `supabase/subscriptions_schema.sql`
- Copy **ALL** the contents
- Paste into the SQL Editor in Supabase

### 4. Run the Query
- Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
- Wait for it to complete (should take a few seconds)

### 5. Verify It Worked
You should see:
- ✅ "Success. No rows returned" or similar success message
- No error messages

### 6. Check Tables Were Created
- Go to **"Table Editor"** in the left sidebar
- You should see these new tables:
  - ✅ `subscription_plans`
  - ✅ `subscriptions`
  - ✅ `payment_methods`
  - ✅ `invoices`

### 7. Verify Plans Were Inserted
- Click on `subscription_plans` table
- You should see 3 rows:
  - **Starter** - $29/month
  - **Professional** - $59/month
  - **Enterprise** - $99/month

---

## ✅ What This Schema Creates

1. **subscription_plans** - Stores the 3 pricing plans
2. **subscriptions** - Links companies to their subscription plan
3. **payment_methods** - Stores payment information (for future Stripe integration)
4. **invoices** - Stores billing history

---

## 🎯 After Running This

Once you've run the schema:
1. Go back to your app
2. Try clicking "Start Free Trial" again
3. It should work now! ✅

---

## ⚠️ If You Get Errors

**Error: "relation already exists"**
- This means the tables already exist
- That's okay! The schema uses `IF NOT EXISTS`, so it's safe to run again

**Error: "permission denied"**
- Make sure you're logged in as the project owner
- Check that you have the correct permissions

**Error: "syntax error"**
- Make sure you copied the entire file
- Check that there are no extra characters

---

## 📝 Notes

- This schema is **safe to run multiple times** (uses `IF NOT EXISTS`)
- It will **update existing plans** if they already exist (uses `ON CONFLICT`)
- All tables have **Row Level Security (RLS)** enabled for security

