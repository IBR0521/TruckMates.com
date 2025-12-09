# Add Missing Environment Variables

## ⚠️ Missing Variables in Vercel

You need to add these 2 environment variables:

---

## 1. RESEND_FROM_EMAIL

**What it is:** Email address to send emails from

**How to add:**
1. In the Vercel Environment Variables page
2. Click "Add Another" or the input fields
3. **Key:** `RESEND_FROM_EMAIL`
4. **Value:** Choose one:
   - `onboarding@resend.dev` (for testing - works immediately)
   - `noreply@truckmateslogistic.com` (if you verified your domain in Resend)

**Recommended:** Use `onboarding@resend.dev` for now (works immediately)

---

## 2. NEXT_PUBLIC_APP_URL

**What it is:** Your website URL (for redirects and email links)

**How to add:**
1. In the Vercel Environment Variables page
2. Click "Add Another"
3. **Key:** `NEXT_PUBLIC_APP_URL`
4. **Value:** 
   - Production: `https://truckmateslogistic.com`
   - Or your Vercel URL: `https://your-project.vercel.app`

**Recommended:** Use your domain: `https://truckmateslogistic.com`

---

## 📋 Steps to Add:

1. **Scroll to the "Add Environment Variable" section** (top of the page)
2. **Add RESEND_FROM_EMAIL:**
   - Key: `RESEND_FROM_EMAIL`
   - Value: `onboarding@resend.dev`
   - Click "Save"
3. **Add NEXT_PUBLIC_APP_URL:**
   - Key: `NEXT_PUBLIC_APP_URL`
   - Value: `https://truckmateslogistic.com`
   - Click "Save"
4. **Redeploy your app** (Vercel will auto-redeploy, or trigger a new deployment)

---

## ✅ After Adding:

1. **Wait for redeploy** (usually 1-2 minutes)
2. **Test email sending:**
   - Go to `/dashboard/settings`
   - Click "Send Test Email"
   - Should work now!

3. **Test employee invitation:**
   - Go to `/dashboard/employees`
   - Add employee
   - Email should send!

---

## 🎯 Quick Copy-Paste:

**Variable 1:**
```
Key: RESEND_FROM_EMAIL
Value: onboarding@resend.dev
```

**Variable 2:**
```
Key: NEXT_PUBLIC_APP_URL
Value: https://truckmateslogistic.com
```

---

**Add these 2 variables and your emails will work!** 📧

