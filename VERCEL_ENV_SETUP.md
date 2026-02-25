# Vercel Environment Variables Setup

## Problem
The production site is showing "Failed to connect to server" because Supabase environment variables are not configured in Vercel.

## Solution: Add Environment Variables to Vercel

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** (this is `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### Step 2: Add Environment Variables to Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project (`truck-mates-com` or similar)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

#### Required Variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxxx.supabase.co`) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key | Production, Preview, Development |

#### Optional (but recommended):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Your Google Maps API key | Production, Preview, Development |
| `GOOGLE_MAPS_API_KEY` | Same as above (for server-side) | Production, Preview, Development |

### Step 3: Redeploy

After adding the environment variables:

1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger a new deployment

### Step 4: Verify

1. Wait for the deployment to complete
2. Visit your production site
3. Try to register a new company
4. The error should be gone!

## Quick Checklist

- [ ] Supabase project is active (not paused)
- [ ] Copied `NEXT_PUBLIC_SUPABASE_URL` from Supabase dashboard
- [ ] Copied `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase dashboard
- [ ] Added both variables to Vercel (all environments: Production, Preview, Development)
- [ ] Redeployed the application
- [ ] Tested registration on production site

## Troubleshooting

### Still seeing the error?

1. **Check Supabase project status**: Make sure your Supabase project is not paused
2. **Verify environment variables**: In Vercel, make sure the variables are set for "Production" environment
3. **Check variable names**: They must be exactly:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Clear browser cache**: Sometimes cached errors persist
5. **Check Vercel logs**: Go to your deployment → Logs to see detailed error messages

### Common Issues

**Issue**: Variables added but still not working
- **Solution**: Make sure you selected "Production" environment when adding variables, then redeploy

**Issue**: "Invalid Supabase URL format"
- **Solution**: Make sure the URL starts with `https://` and ends with `.supabase.co`

**Issue**: "Unauthorized" errors
- **Solution**: Make sure you copied the `anon` key, not the `service_role` key


