# Fix "Email address is invalid" Error

## Problem
Supabase is rejecting your email address. This is usually because:
1. Email confirmation is enabled (requires email verification)
2. Email validation is too strict

## Solution: Disable Email Confirmation (For Development)

### Step 1: Go to Supabase Settings

1. **Open Supabase Dashboard**
2. Go to **Authentication** → **Providers**
3. Click on **Email** provider

### Step 2: Disable Email Confirmation

1. Find **"Confirm email"** toggle
2. **Turn it OFF** (disable it)
3. Click **"Save"**

### Step 3: Also Check Email Template Settings

1. Still in **Authentication** → **Providers** → **Email**
2. Scroll down to **"Email Templates"**
3. Make sure templates are configured (or leave defaults)

### Step 4: Try Registering Again

1. Go back to your app
2. Try registering with your email: `ir20080522@gmail.com`
3. It should work now!

---

## Alternative: If Email Still Doesn't Work

### Check Email Format
Make sure there are no extra spaces:
- ✅ `ir20080522@gmail.com`
- ❌ ` ir20080522@gmail.com ` (with spaces)

### Try a Different Email
For testing, try:
- `test@example.com`
- `user@test.com`

---

## For Production (Later)

When you're ready to deploy:
1. Re-enable email confirmation
2. Set up email templates
3. Configure SMTP settings (or use Supabase's email service)

---

## Quick Fix Summary

**Supabase Dashboard** → **Authentication** → **Providers** → **Email** → **Turn OFF "Confirm email"** → **Save**

Then try registering again!

