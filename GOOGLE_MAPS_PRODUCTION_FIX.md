# Google Maps API Production Fix Guide

## Problem
Google Maps works in demo/local but **not working on online/production platform**.

## Common Causes & Solutions

### 1. ✅ **Missing Environment Variable in Vercel**

**Most Common Issue**: The `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not set in Vercel.

#### How to Fix:
1. Go to your **Vercel Dashboard**
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = your_actual_api_key_here
   ```
   OR
   ```
   GOOGLE_MAPS_API_KEY = your_actual_api_key_here
   ```
5. **Important**: Set it for **Production**, **Preview**, and **Development** environments
6. **Redeploy** your application after adding the variable

#### Verify:
- Check Vercel deployment logs for any errors
- The variable should show as "Encrypted" in Vercel dashboard

---

### 2. ✅ **API Key Domain Restrictions**

**Issue**: Google Cloud Console has domain restrictions that block your production domain.

#### How to Fix:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key
4. Under **Application restrictions**, check:
   - If set to **HTTP referrers (web sites)**, add your production domain:
     ```
     https://your-production-domain.com/*
     https://*.vercel.app/*
     ```
   - If set to **None**, change to **HTTP referrers** and add domains
5. **Save** the changes
6. Wait 5-10 minutes for changes to propagate

#### Important:
- Add both your custom domain AND Vercel domain (`*.vercel.app`)
- Use `/*` at the end to allow all paths
- Don't forget `https://` protocol

---

### 3. ✅ **API Not Enabled**

**Issue**: The required Google Maps APIs are not enabled for your project.

#### How to Fix:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Library**
3. Enable these APIs:
   - ✅ **Maps JavaScript API** (REQUIRED)
   - ✅ **Places API** (for address autocomplete)
   - ✅ **Directions API** (for route optimization)
   - ✅ **Geocoding API** (for address conversion)
4. Wait a few minutes for APIs to activate

---

### 4. ✅ **API Key Billing/Quota Issues**

**Issue**: Your Google Cloud project has billing disabled or quota exceeded.

#### How to Fix:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Check **Billing**:
   - Ensure billing account is linked
   - Check if you've exceeded free tier limits
   - Verify payment method is valid
3. Check **Quotas**:
   - Go to **APIs & Services** → **Dashboard**
   - Check if any APIs show quota exceeded
   - Request quota increase if needed

---

### 5. ✅ **Wrong Environment Variable Name**

**Issue**: Code expects `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` but you set `GOOGLE_MAPS_API_KEY`.

#### How to Fix:
The code checks both, but **prefers** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for client-side use.

**Set BOTH in Vercel**:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = your_key_here
GOOGLE_MAPS_API_KEY = your_key_here
```

---

### 6. ✅ **Build-Time vs Runtime Issue**

**Issue**: `NEXT_PUBLIC_*` variables are embedded at build time, not runtime.

#### How to Fix:
1. **Redeploy** after adding environment variables
2. Don't just update variables - trigger a new deployment
3. In Vercel: Go to **Deployments** → **Redeploy**

---

## Step-by-Step Fix Process

### Step 1: Verify API Key in Vercel
```bash
# Check Vercel dashboard
Settings → Environment Variables → Look for NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

### Step 2: Check Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Click your API key
4. Verify:
   - ✅ APIs are enabled (Maps JavaScript API)
   - ✅ Domain restrictions include your production domain
   - ✅ No IP restrictions blocking Vercel

### Step 3: Test API Key Directly
Open browser console on production site and run:
```javascript
fetch('/api/google-maps-key')
  .then(r => r.json())
  .then(console.log)
```

**Expected Response**:
```json
{
  "apiKey": "AIzaSy..."
}
```

**If Error**:
```json
{
  "error": "Google Maps API key not configured..."
}
```
→ This means the environment variable is not set in Vercel

### Step 4: Check Browser Console Errors
Open browser DevTools (F12) on production site and look for:
- `Google Maps API error: RefererNotAllowedMapError` → Domain restriction issue
- `Google Maps API error: ApiNotActivatedMapError` → API not enabled
- `Google Maps API error: InvalidKeyMapError` → Wrong API key
- `Failed to load Google Maps` → API key missing or invalid

### Step 5: Verify Script Loading
In browser console, check if script is loading:
```javascript
document.querySelector('script[src*="maps.googleapis.com"]')
```

If `null`, the script isn't being added (API key issue).
If script exists, check its `src` attribute for the API key.

---

## Quick Diagnostic Checklist

- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in Vercel
- [ ] Environment variable is set for **Production** environment
- [ ] Application was **redeployed** after adding variable
- [ ] Google Cloud Console: **Maps JavaScript API** is enabled
- [ ] Google Cloud Console: API key has **no domain restrictions** OR includes your production domain
- [ ] Google Cloud Console: **Billing** is enabled
- [ ] API key is **not expired** or **revoked**
- [ ] Browser console shows no API key errors

---

## Testing After Fix

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** the page (Ctrl+Shift+R)
3. **Check browser console** for any errors
4. **Verify map loads** within 2-3 seconds

---

## Debug Endpoint

You can use this endpoint to check if API key is configured:
```
https://your-production-domain.com/api/google-maps-key
```

**Success Response**:
```json
{
  "apiKey": "AIzaSy..."
}
```

**Error Response**:
```json
{
  "error": "Google Maps API key not configured...",
  "availableEnvVars": {
    "GOOGLE_MAPS_API_KEY": false,
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": false
  }
}
```

---

## Most Likely Solution

**90% of the time**, the issue is:
1. ✅ Environment variable not set in Vercel
2. ✅ Domain restrictions in Google Cloud Console

**Fix both** and redeploy!

---

## Still Not Working?

If after all these steps it's still not working:

1. **Check Vercel deployment logs** for build errors
2. **Check browser console** for specific error messages
3. **Test API key directly** in Google Cloud Console
4. **Create a new API key** and try again
5. **Contact support** with:
   - Error message from browser console
   - Vercel deployment URL
   - API key restrictions screenshot


