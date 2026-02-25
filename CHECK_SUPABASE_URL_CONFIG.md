# How to Check Your Platform URL in Supabase

## Where to Check Your Platform URL Configuration

You need to check **two places**:

### 1. Supabase Dashboard - Authentication Settings

This is where you configure **redirect URLs** and **site URL**:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (ozzcdefgnutcotcgqruf)
3. **Go to**: Authentication → URL Configuration
4. **Check these settings**:

   - **Site URL**: This should be your production URL (e.g., `https://your-app.vercel.app`)
   - **Redirect URLs**: This is a list of allowed redirect URLs. Make sure it includes:
     - Your production URL: `https://your-app.vercel.app/**`
     - Your localhost (for development): `http://localhost:3000/**`
     - Any other domains you use

### 2. Vercel Environment Variables

Check what `NEXT_PUBLIC_APP_URL` is set to in Vercel:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**
3. **Go to**: Settings → Environment Variables
4. **Look for**: `NEXT_PUBLIC_APP_URL`
5. **Check the value** - it should be your production URL, NOT `http://localhost:3000`

---

## Common Issue: localhost in Production

If you see `http://localhost:3000` in:
- **Supabase Site URL** → Change it to your production URL
- **Vercel `NEXT_PUBLIC_APP_URL`** → Change it to your production URL

---

## How to Fix

### Fix Supabase Site URL:

1. Go to: **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. **Site URL**: Change from `http://localhost:3000` to `https://your-production-url.vercel.app`
3. **Redirect URLs**: Add your production URL:
   ```
   https://your-production-url.vercel.app/**
   http://localhost:3000/**
   ```
4. **Save changes**

### Fix Vercel Environment Variable:

1. Go to: **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_APP_URL`
3. **Edit** it to your production URL: `https://your-production-url.vercel.app`
4. **Redeploy** your application

---

## Quick Check Commands

You can also check what URL your app is using:

1. **Visit your production site**: `https://your-app.vercel.app/diagnostics`
2. **Check the API**: `https://your-app.vercel.app/api/check-env`

These pages will show you what URLs are configured.


