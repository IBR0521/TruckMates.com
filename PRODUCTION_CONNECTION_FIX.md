# Production Connection Issue - Quick Fix Guide

## Problem
The online/production platform is not working while the demo works fine. This is because **Supabase environment variables are not configured in your production environment (Vercel)**.

## Quick Diagnosis

1. **Visit the diagnostics page**: Go to `https://your-domain.com/diagnostics`
   - This will show you exactly what's missing

2. **Check the health endpoint**: Visit `https://your-domain.com/api/health`
   - Should return connection status

## Solution: Configure Environment Variables in Vercel

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** → This is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2: Add to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add these two variables:

#### Variable 1:
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- **Environment**: Select **Production**, **Preview**, and **Development**

#### Variable 2:
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Your Supabase anon/public key
- **Environment**: Select **Production**, **Preview**, and **Development**

### Step 3: Redeploy

**IMPORTANT**: After adding environment variables, you MUST redeploy:

1. Go to **Deployments** tab in Vercel
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

### Step 4: Verify

1. Visit your production site
2. Go to `/diagnostics` to verify all checks pass
3. Try logging in or registering

## Why Demo Works But Production Doesn't

- **Demo**: Uses local `.env.local` file with your Supabase credentials
- **Production**: Needs environment variables configured in Vercel
- These are separate configurations!

## Common Issues

### Issue: Added variables but still not working
**Solution**: 
- Make sure you selected **Production** environment when adding
- **Redeploy** after adding variables (this is critical!)
- Clear browser cache

### Issue: "Invalid Supabase URL format"
**Solution**: 
- URL must start with `https://`
- URL must end with `.supabase.co`
- Example: `https://abcdefghijklmnop.supabase.co`

### Issue: "Unauthorized" errors
**Solution**: 
- Make sure you copied the **anon** key, not the **service_role** key
- The anon key is safe to use in client-side code
- Service role key should NEVER be exposed

### Issue: Variables show in Vercel but diagnostics still fail
**Solution**:
- Check that variables are set for **Production** environment (not just Preview/Development)
- Verify variable names are EXACTLY:
  - `NEXT_PUBLIC_SUPABASE_URL` (case-sensitive)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (case-sensitive)
- Redeploy after any changes

## Verification Checklist

- [ ] Supabase project is active (not paused)
- [ ] Copied correct URL from Supabase dashboard
- [ ] Copied correct anon key (not service_role)
- [ ] Added both variables to Vercel
- [ ] Selected **Production** environment for both
- [ ] Redeployed application
- [ ] Visited `/diagnostics` and all checks pass
- [ ] Tested login/registration on production

## Still Having Issues?

1. **Check Vercel Logs**:
   - Go to your deployment → **Logs** tab
   - Look for error messages

2. **Check Supabase Status**:
   - Verify project is not paused
   - Check [Supabase Status Page](https://status.supabase.com/)

3. **Test Connection**:
   - Visit `/api/health` on production
   - Visit `/api/test-connection` on production
   - Check response for specific error messages

4. **Contact Support**:
   - Include error messages from diagnostics page
   - Include Vercel deployment logs
   - Include Supabase project URL (without key)

---

**Quick Links**:
- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Dashboard](https://supabase.com/dashboard)
- Diagnostics Page: `/diagnostics`


