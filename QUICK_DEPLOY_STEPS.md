# Quick Deployment Steps

## Option 1: If You Have Git Repository

### Step 1: Commit and Push
```bash
git add .
git commit -m "Add employee management system"
git push origin main
```

Vercel will automatically deploy when you push.

---

## Option 2: If You Don't Have Git (Manual Upload)

### Step 1: Prepare Files for Upload

1. **Create a ZIP file** of your project (excluding node_modules, .next, .git):
   ```bash
   # Exclude these folders:
   - node_modules/
   - .next/
   - .git/
   - .vercel/
   ```

2. **Or use the prepare script** (if you have it):
   ```bash
   ./prepare-upload.sh
   ```

### Step 2: Upload to Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project

2. **Deploy:**
   - If connected to Git: It auto-deploys on push
   - If manual: Use Vercel CLI or drag-and-drop

---

## Step 3: Run Database Migrations (CRITICAL!)

**You MUST run these in your PRODUCTION Supabase:**

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your **production project** (not dev/local)

2. **Run Migration 1:**
   - SQL Editor → New query
   - Copy from: `supabase/employee_management_schema_safe.sql`
   - Paste and Run

3. **Run Migration 2:**
   - SQL Editor → New query
   - Copy from: `supabase/fix_users_rls_recursion.sql`
   - Paste and Run

---

## Step 4: Verify Environment Variables

**In Vercel Dashboard → Settings → Environment Variables:**

- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `RESEND_API_KEY`
- ✅ `RESEND_FROM_EMAIL`
- ✅ `NEXT_PUBLIC_APP_URL`

---

## Step 5: Test

1. Visit your live site
2. Log in as manager
3. Go to `/dashboard/employees`
4. Try adding an employee
5. Check if it works!

---

**Most Important:** Don't forget to run the database migrations in PRODUCTION Supabase! 🚨

