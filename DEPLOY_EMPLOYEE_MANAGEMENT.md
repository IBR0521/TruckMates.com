# Deploy Employee Management to Production

## Step-by-Step Deployment Guide

### Step 1: Commit All Changes to Git

1. **Check what files changed:**
   ```bash
   git status
   ```

2. **Add all new/modified files:**
   ```bash
   git add .
   ```

3. **Commit with a message:**
   ```bash
   git commit -m "Add employee management system with invitations"
   ```

4. **Push to your repository:**
   ```bash
   git push origin main
   ```
   (or `git push origin master` if your main branch is called master)

---

### Step 2: Run Database Migrations in Production Supabase

**IMPORTANT:** You need to run the SQL migrations in your **production Supabase** (not local/dev).

1. **Go to your production Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your **production project**

2. **Run the employee management schema:**
   - Go to **SQL Editor** → **New query**
   - Open: `supabase/employee_management_schema_safe.sql`
   - Copy ALL the SQL code
   - Paste into Supabase SQL Editor
   - Click **"Run"**

3. **Run the RLS recursion fix:**
   - Go to **SQL Editor** → **New query**
   - Open: `supabase/fix_users_rls_recursion.sql`
   - Copy ALL the SQL code
   - Paste into Supabase SQL Editor
   - Click **"Run"**

---

### Step 3: Verify Vercel Deployment

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project

2. **Check deployment status:**
   - After pushing to git, Vercel should automatically start deploying
   - Wait for deployment to complete (usually 1-3 minutes)
   - Check for any build errors

3. **If deployment fails:**
   - Check the build logs
   - Common issues:
     - Missing environment variables
     - Build errors
     - TypeScript errors

---

### Step 4: Verify Environment Variables in Vercel

Make sure these are set in Vercel:

1. **Go to Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **Verify these are set:**
   - `NEXT_PUBLIC_SUPABASE_URL` - Your production Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your production Supabase anon key
   - `RESEND_API_KEY` - Your Resend API key (for email invitations)
   - `RESEND_FROM_EMAIL` - Your verified email in Resend
   - `NEXT_PUBLIC_APP_URL` - Your production domain (e.g., `https://truckmateslogistic.com`)

3. **If any are missing, add them:**
   - Click **"Add New"**
   - Enter variable name and value
   - Select environment (Production, Preview, Development)
   - Click **"Save"**

4. **Redeploy after adding variables:**
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**

---

### Step 5: Test the Deployment

1. **Visit your production site:**
   - Go to `https://truckmateslogistic.com` (or your domain)

2. **Test as Manager:**
   - Log in as a manager account
   - Go to `/dashboard/employees`
   - Try adding an employee
   - Check if invitation email is sent

3. **Test as Employee:**
   - Register a new account
   - Go to account setup
   - Enter an invitation code
   - Verify it links to company

---

### Step 6: Verify Database Tables

1. **Go to Supabase Dashboard** → **Table Editor**

2. **Verify these tables exist:**
   - ✅ `invitation_codes` table
   - ✅ `users` table has `position` and `employee_status` columns

3. **Check RLS policies:**
   - Go to **Authentication** → **Policies**
   - Verify policies exist for `users` and `invitation_codes` tables

---

## Quick Checklist

- [ ] All code committed and pushed to git
- [ ] Database migrations run in production Supabase
- [ ] RLS recursion fix applied in production
- [ ] Vercel deployment successful
- [ ] Environment variables set in Vercel
- [ ] Tested employee management as manager
- [ ] Tested invitation acceptance as employee
- [ ] Verified email invitations are sent

---

## Troubleshooting

### Issue: "invitation_codes table not found"
**Solution:** Run the database migration in production Supabase

### Issue: "Infinite recursion detected"
**Solution:** Run the RLS recursion fix SQL in production

### Issue: "Employees link not showing"
**Solution:** 
- Verify your user role is `manager` in production database
- Hard refresh browser (Ctrl+Shift+R)
- Check browser console for errors

### Issue: "Email not sending"
**Solution:**
- Verify `RESEND_API_KEY` is set in Vercel
- Verify `RESEND_FROM_EMAIL` is verified in Resend
- Check Resend dashboard for email logs

---

## After Deployment

Once everything is deployed:
1. ✅ Employee management is live
2. ✅ Managers can add employees
3. ✅ Invitation emails are sent
4. ✅ Employees can join companies with codes

**Your employee management system is now live!** 🚀

