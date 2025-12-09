# Quick Connection Test 🧪

## Fast 5-Minute Test

Run through these quick tests to verify everything is connected:

---

## Test 1: Login & Dashboard (30 seconds)

1. Go to your website: `https://truckmateslogistic.com` (or `http://localhost:3000`)
2. Login with your account
3. Should redirect to dashboard
4. Dashboard should load without errors

**✅ Pass:** Dashboard loads
**❌ Fail:** Shows error → Check Supabase connection

---

## Test 2: Email Configuration (1 minute)

1. Go to `/dashboard/settings`
2. Scroll to "Email Notifications"
3. Check status:
   - **Green alert** = ✅ Configured
   - **Yellow/Red alert** = ❌ Not configured
4. Click "Send Test Email"
5. Check your email inbox

**✅ Pass:** Email received
**❌ Fail:** No email → Check `RESEND_API_KEY` in Vercel

---

## Test 3: Employee Invitation (1 minute)

1. Go to `/dashboard/employees`
2. Click "Add Employee"
3. Enter your own email (to test)
4. Click "Send Invitation"
5. Check email inbox

**✅ Pass:** Invitation email received
**❌ Fail:** No email → Check Resend configuration

---

## Test 4: Free Trial (1 minute)

1. Logout and create new test account
2. Go to `/plans`
3. Click "Start Free Trial" on any plan
4. Should redirect to dashboard
5. Go to `/dashboard/settings`
6. Check "Billing & Subscription" section

**✅ Pass:** Shows active trial
**❌ Fail:** No subscription → Check database tables

---

## Test 5: Core Features (2 minutes)

1. **Add Driver:**
   - Go to `/dashboard/drivers/add`
   - Fill form and save
   - Should show success

2. **Add Truck:**
   - Go to `/dashboard/trucks/add`
   - Fill form and save
   - Should show success

3. **Add Load:**
   - Go to `/dashboard/loads/add`
   - Fill form and save
   - Should show success

**✅ Pass:** All features work
**❌ Fail:** Error on save → Check database tables

---

## 🚨 Quick Fixes

### If Test 1 Fails:
- Check `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel

### If Test 2 Fails:
- Add `RESEND_API_KEY` to Vercel
- Add `RESEND_FROM_EMAIL` to Vercel

### If Test 3 Fails:
- Same as Test 2
- Check Resend dashboard for errors

### If Test 4 Fails:
- Run `supabase/subscriptions_schema.sql` in Supabase
- Check `subscription_plans` table exists

### If Test 5 Fails:
- Check database tables exist
- Run migration scripts if needed

---

## ✅ All Tests Pass?

**Everything is connected correctly!** 🎉

If any test fails, let me know which one and I'll help fix it!

