# Debug: Employees Section Not Visible

## Step-by-Step Troubleshooting

### Step 1: Check Vercel Deployment Status

1. **Go to:** https://vercel.com/dashboard
2. **Select your project**
3. **Check the latest deployment:**
   - Is it **"Ready"** (green checkmark)?
   - Or is it still building/failed?

**If deployment failed:**
- Click on the failed deployment
- Check the build logs for errors
- Share the error message

---

### Step 2: Verify Database Migrations in PRODUCTION

**CRITICAL:** Make sure you ran these in your **PRODUCTION** Supabase (not dev/local)!

1. **Go to:** https://supabase.com/dashboard
2. **Select your PRODUCTION project** (the one connected to your live site)
3. **SQL Editor → Check if function exists:**

Run this query:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_role_and_company';
```

**If it returns nothing:**
- The function doesn't exist
- You need to run: `supabase/fix_users_rls_recursion.sql`

4. **Check if table exists:**

Run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'invitation_codes';
```

**If it returns nothing:**
- The table doesn't exist
- You need to run: `supabase/employee_management_schema_safe.sql`

---

### Step 3: Verify Your User Role

1. **Go to Supabase Dashboard → Table Editor**
2. **Open `users` table**
3. **Find your user record** (by email)
4. **Check the `role` column:**
   - Should be exactly: `"manager"` (lowercase, with quotes)
   - Not: `"Manager"`, `"MANAGER"`, or `null`

**If it's not "manager":**

Run this SQL (replace with your email):
```sql
UPDATE public.users 
SET role = 'manager' 
WHERE email = 'your-email@example.com';
```

---

### Step 4: Hard Refresh Browser

1. **Open your live site**
2. **Press:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. **Or:** Clear browser cache completely

---

### Step 5: Check Browser Console

1. **Open your live site**
2. **Press F12** to open Developer Tools
3. **Go to Console tab**
4. **Look for errors** (red text)
5. **Check for:**
   - "Error getting user role"
   - "get_user_role_and_company" errors
   - Any RLS policy errors

---

### Step 6: Verify You're on Production

**Make sure you're checking:**
- ✅ Your live domain (e.g., `https://truckmateslogistic.com`)
- ❌ NOT localhost
- ❌ NOT a dev/staging environment

---

## Quick Checklist

- [ ] Vercel deployment is "Ready" (green)
- [ ] Database migrations run in **PRODUCTION** Supabase
- [ ] `get_user_role_and_company()` function exists
- [ ] `invitation_codes` table exists
- [ ] Your user role is `"manager"` in production database
- [ ] Hard refreshed browser
- [ ] Checked browser console for errors
- [ ] Checking the correct production URL

---

## Most Common Issues

1. **Migrations not run in production** → Run them now!
2. **User role not "manager"** → Update it in database
3. **Deployment still building** → Wait for it to finish
4. **Browser cache** → Hard refresh

---

**Tell me which step you're stuck on, and I'll help!** 🔍

