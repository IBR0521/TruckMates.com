# Deployment Checklist for Employee Management

## ✅ Files to Deploy

### New Files (Employee Management):
- ✅ `app/actions/employees.ts` - Server actions for employee management
- ✅ `app/dashboard/employees/page.tsx` - Employee management page
- ✅ `supabase/employee_management_schema_safe.sql` - Database migration
- ✅ `supabase/fix_users_rls_recursion.sql` - RLS fix

### Modified Files:
- ✅ `app/account-setup/manager/page.tsx` - Now saves invitations to DB
- ✅ `app/account-setup/user/page.tsx` - Now verifies invitation codes
- ✅ `components/dashboard/sidebar.tsx` - Added Employees link (managers only)
- ✅ `app/actions/notifications.ts` - Email sending support

---

## 🚀 Deployment Steps

### Step 1: Commit and Push Code

```bash
# Add all changes
git add .

# Commit
git commit -m "Add employee management system with invitations and email notifications"

# Push to repository
git push origin main
```

**Vercel will automatically deploy when you push!**

---

### Step 2: Run Database Migrations in PRODUCTION Supabase

**⚠️ CRITICAL: Run these in your PRODUCTION Supabase, not dev!**

1. **Go to:** https://supabase.com/dashboard
2. **Select your PRODUCTION project**
3. **SQL Editor → New query**

#### Migration 1: Employee Management Schema
- Copy from: `supabase/employee_management_schema_safe.sql`
- Paste and Run

#### Migration 2: Fix RLS Recursion
- Copy from: `supabase/fix_users_rls_recursion.sql`
- Paste and Run

---

### Step 3: Verify Environment Variables in Vercel

**Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables

Make sure these are set:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` (production URL)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (production key)
- ✅ `RESEND_API_KEY`
- ✅ `RESEND_FROM_EMAIL`
- ✅ `NEXT_PUBLIC_APP_URL` (e.g., `https://truckmateslogistic.com`)

---

### Step 4: Test Deployment

1. **Visit:** https://truckmateslogistic.com (or your domain)
2. **Log in as manager**
3. **Go to:** `/dashboard/employees`
4. **Test:**
   - Add an employee
   - Check if invitation email is sent
   - Verify employee can use code to join

---

## ✅ Final Checklist

- [ ] Code committed and pushed to git
- [ ] Vercel deployment successful
- [ ] Database migrations run in PRODUCTION Supabase
- [ ] Environment variables verified in Vercel
- [ ] Tested employee management as manager
- [ ] Tested invitation acceptance as employee
- [ ] Verified email invitations work

---

## 🐛 If Something Goes Wrong

### "invitation_codes table not found"
→ Run database migration in production Supabase

### "Infinite recursion detected"
→ Run RLS fix SQL in production Supabase

### "Employees link not showing"
→ Check user role is `manager` in production database

### "Email not sending"
→ Verify Resend API key and from email in Vercel

---

**Ready to deploy? Run the commands above!** 🚀

