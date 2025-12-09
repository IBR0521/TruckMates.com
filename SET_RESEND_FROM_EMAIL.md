# How to Set RESEND_FROM_EMAIL in Vercel

## Step-by-Step Instructions

### Step 1: Go to Vercel Environment Variables

1. **Go to:** https://vercel.com/dashboard
2. **Select your project** (TruckMates)
3. **Click:** "Settings" (gear icon)
4. **Click:** "Environment Variables" in the left sidebar

---

### Step 2: Add RESEND_FROM_EMAIL

1. **Click:** "Add New" button
2. **Fill in:**
   - **Key:** `RESEND_FROM_EMAIL`
   - **Value:** Choose one of these options:

#### Option A: Use Your Verified Domain (Recommended)
If you verified your domain in Resend:
- Value: `noreply@truckmateslogistic.com`
- Or: `hello@truckmateslogistic.com`
- Or: `invitations@truckmateslogistic.com`

#### Option B: Use Default Resend Email (Limited)
If you haven't verified a domain:
- Value: `onboarding@resend.dev`
- ⚠️ **Note:** This has sending limits (100 emails/day)

3. **Select environments:** 
   - ✅ Production
   - ✅ Preview (optional)
   - ✅ Development (optional)

4. **Click:** "Save"

---

### Step 3: Redeploy

After adding the variable:

1. **Go to:** "Deployments" tab
2. **Click:** "..." on the latest deployment
3. **Click:** "Redeploy"
4. **Or:** Just push a new commit to trigger redeploy

---

## How to Check Your Verified Domain in Resend

1. **Go to:** https://resend.com/domains
2. **Check if** `truckmateslogistic.com` is verified
3. **If verified:** Use `noreply@truckmateslogistic.com` or similar
4. **If not verified:** Use `onboarding@resend.dev` (temporary)

---

## Quick Summary

**What to add in Vercel:**
- **Key:** `RESEND_FROM_EMAIL`
- **Value:** `noreply@truckmateslogistic.com` (if domain verified) OR `onboarding@resend.dev` (if not)
- **Environments:** Production (and others if needed)

**After adding:**
- Redeploy your app
- Test sending an invitation
- Emails should now send!

---

**Add this environment variable and emails will start working!** 📧

