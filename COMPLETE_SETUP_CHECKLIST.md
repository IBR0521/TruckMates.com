# Complete Setup Checklist ✅

## 🎯 Verify Everything is Connected Correctly

Use this checklist to ensure all systems are properly configured and working.

---

## 1. Database Setup ✅

### Check Supabase Tables:

Go to **Supabase Dashboard** → **Table Editor** and verify these tables exist:

- [ ] `users` - User accounts
- [ ] `companies` - Company information
- [ ] `drivers` - Driver records
- [ ] `trucks` - Vehicle records
- [ ] `routes` - Route information
- [ ] `loads` - Load/shipment records
- [ ] `invitation_codes` - Employee invitations
- [ ] `subscription_plans` - Subscription plans
- [ ] `subscriptions` - Active subscriptions
- [ ] `eld_devices` - ELD devices
- [ ] `eld_logs` - ELD logs
- [ ] `notification_preferences` - Email preferences

**If any are missing:**
- Run the corresponding SQL migration files in Supabase SQL Editor

---

## 2. Environment Variables ✅

### Check Vercel Environment Variables:

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

**Required Variables:**

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- [ ] `RESEND_API_KEY` - Resend API key (for emails)
- [ ] `RESEND_FROM_EMAIL` - Email address to send from
- [ ] `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., `https://truckmateslogistic.com`)

**Optional (for later):**
- [ ] `STRIPE_SECRET_KEY` - For payments (when you set up bank account)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- [ ] `PAYPAL_CLIENT_ID` - PayPal credentials (if using PayPal)

**How to Check:**
1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Verify all required variables are set
5. Make sure they're set for **Production**, **Preview**, and **Development**

---

## 3. Email Configuration ✅

### Test Email Sending:

1. **Go to Settings Page:**
   - Login to your SaaS
   - Go to `/dashboard/settings`
   - Scroll to "Email Notifications" section

2. **Check Email Configuration:**
   - Should show green alert if configured
   - Should show yellow/red if not configured

3. **Send Test Email:**
   - Click "Send Test Email" button
   - Check your email inbox
   - Check spam folder if not received

4. **Test Employee Invitation:**
   - Go to `/dashboard/employees`
   - Click "Add Employee"
   - Enter a test email
   - Check if invitation email is received

**If emails don't send:**
- Check `RESEND_API_KEY` is set in Vercel
- Check `RESEND_FROM_EMAIL` is set
- Verify domain in Resend (if using custom domain)
- Check Vercel logs for errors

---

## 4. Subscription System ✅

### Test Free Trial:

1. **Go to Plans Page:**
   - Visit `/plans`
   - Should show 3 plans (Starter, Professional, Enterprise)
   - Should show "7-DAY FREE TRIAL" badge

2. **Start Trial:**
   - Click "Start Free Trial" on any plan
   - Should redirect to dashboard
   - Should show success message

3. **Check Subscription:**
   - Go to `/dashboard/settings`
   - Scroll to "Billing & Subscription"
   - Should show your active trial
   - Should show trial end date

4. **Verify Trial Status:**
   - Status should be "Trial"
   - Should show days remaining
   - Should show plan details

**If trial doesn't work:**
- Check `subscription_plans` table exists in Supabase
- Check `subscriptions` table exists
- Run `supabase/subscriptions_schema.sql` if needed

---

## 5. Employee Management ✅

### Test Employee Features:

1. **Check Employees Page:**
   - Go to `/dashboard/employees` (managers only)
   - Should see employees list
   - Should see "Add Employee" button

2. **Test Adding Employee:**
   - Click "Add Employee"
   - Enter email address
   - Click "Send Invitation"
   - Should show success message
   - Check if email is received

3. **Test Invitation Code:**
   - Copy invitation code from email or UI
   - Go to `/account-setup/user`
   - Enter invitation code
   - Should accept and join company

**If employees don't work:**
- Check `invitation_codes` table exists
- Check `users` table has `position` and `employee_status` columns
- Run `supabase/employee_management_schema_safe.sql` if needed

---

## 6. ELD Service ✅

### Test ELD Features:

1. **Check ELD Page:**
   - Go to `/dashboard/eld`
   - Should show ELD dashboard (Professional/Enterprise plans only)
   - Starter plan should show upgrade message

2. **Test Adding ELD Device:**
   - Go to `/dashboard/eld/devices`
   - Click "Add ELD Device"
   - Fill in device information
   - Should save successfully

**If ELD doesn't work:**
- Check `eld_devices` table exists
- Check `eld_logs`, `eld_locations`, `eld_events` tables exist
- Run `supabase/eld_schema.sql` if needed

---

## 7. Domain & DNS ✅

### Check Domain Configuration:

1. **Verify Domain:**
   - Visit your domain (e.g., `https://truckmateslogistic.com`)
   - Should load your SaaS
   - Should show SSL certificate (lock icon)

2. **Check DNS Records:**
   - Go to Hostinger DNS settings
   - Verify A record points to Vercel IP
   - Verify CNAME records if any

3. **Check Vercel Domain:**
   - Go to Vercel Dashboard → Settings → Domains
   - Verify your domain is added
   - Should show "Valid Configuration"

---

## 8. Authentication ✅

### Test Login/Registration:

1. **Test Registration:**
   - Go to `/register/manager`
   - Create new account
   - Should create company and user
   - Should redirect to plans page

2. **Test Login:**
   - Go to `/login`
   - Login with credentials
   - Should redirect to dashboard
   - Should show user data

3. **Test Session:**
   - Refresh page
   - Should stay logged in
   - Should show correct user data

---

## 9. Core Features ✅

### Test Main Features:

- [ ] **Dashboard** - Loads without errors
- [ ] **Drivers** - Can add/view/edit drivers
- [ ] **Trucks** - Can add/view/edit trucks
- [ ] **Routes** - Can add/view/edit routes
- [ ] **Loads** - Can add/view/edit loads
- [ ] **IFTA Reports** - Can generate reports
- [ ] **Accounting** - Can manage invoices/expenses
- [ ] **Maintenance** - Can schedule maintenance
- [ ] **Documents** - Can upload documents
- [ ] **Reports** - Can view reports

---

## 10. Error Checking ✅

### Check for Errors:

1. **Browser Console:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Check for red errors
   - Should be no critical errors

2. **Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Logs
   - Check for error messages
   - Should be no server errors

3. **Network Tab:**
   - Open DevTools → Network tab
   - Refresh page
   - Check for failed requests (red)
   - All requests should succeed (200 status)

---

## 🚨 Common Issues & Quick Fixes

### Issue: "Internal Server Error"
**Fix:** Check Vercel logs, verify environment variables are set

### Issue: "Table does not exist"
**Fix:** Run corresponding SQL migration in Supabase

### Issue: "Email not sending"
**Fix:** Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel

### Issue: "Subscription not working"
**Fix:** Run `supabase/subscriptions_schema.sql` in Supabase

### Issue: "Employees page not visible"
**Fix:** Check user role is "manager", verify RLS policies

### Issue: "ELD not accessible"
**Fix:** Check subscription plan (Professional/Enterprise only)

---

## ✅ Quick Test Flow

1. **Login** → Should work
2. **Go to Dashboard** → Should load
3. **Go to Settings** → Check email config
4. **Send Test Email** → Should receive email
5. **Go to Employees** → Add employee → Check email received
6. **Go to Plans** → Start trial → Check subscription in settings
7. **Add Driver** → Should work
8. **Add Truck** → Should work
9. **Add Load** → Should work

---

## 📋 Summary Checklist

- [ ] All database tables exist
- [ ] All environment variables set in Vercel
- [ ] Email sending works (test email)
- [ ] Employee invitations work
- [ ] Free trial works
- [ ] Subscription shows in settings
- [ ] Domain loads correctly
- [ ] No console errors
- [ ] No server errors in Vercel logs
- [ ] All main features work

---

## 🎯 Priority Checks

**Must Work:**
1. ✅ Login/Registration
2. ✅ Email sending
3. ✅ Employee invitations
4. ✅ Free trial
5. ✅ Core features (drivers, trucks, loads)

**Can Fix Later:**
- Payment processing (when you have bank account)
- ELD service (if not on Professional plan)
- Advanced features

---

**Go through this checklist and let me know what's not working!** 🔍

