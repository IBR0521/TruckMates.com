# Mapbox Address Autocomplete Setup Guide

## Why Mapbox?

We've migrated from Google Places Autocomplete to **Mapbox Geocoding API** for address autocomplete because:

- ✅ **Better pricing** - Free tier: 100,000 requests/month
- ✅ **Excellent UK/EU coverage** - Great for international addresses
- ✅ **Easier styling** - Matches dark theme better
- ✅ **Cleaner API** - Simpler integration
- ✅ **No deprecation warnings** - Modern, actively maintained API

## Step 1: Get Mapbox API Key

1. **Sign up** at [https://www.mapbox.com/](https://www.mapbox.com/)
   - Free tier includes 100,000 geocoding requests/month
   - No credit card required for free tier

2. **Get your access token:**
   - Go to [Account → Access tokens](https://account.mapbox.com/access-tokens/)
   - Copy your **Default public token** (starts with `pk.`)

## Step 2: Add API Key to Environment Variables

### For Local Development:

1. Create or edit `.env.local` in your project root:
   ```env
   NEXT_PUBLIC_MAPBOX_API_KEY=pk.your_token_here
   ```

2. **Restart your development server:**
   ```bash
   npm run dev
   ```

### For Production (Vercel):

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add:
   - **Name:** `NEXT_PUBLIC_MAPBOX_API_KEY`
   - **Value:** `pk.your_token_here`
   - **Environment:** Production, Preview, Development (select all)

3. **Redeploy** your application

## Step 3: Verify It's Working

1. Open the **Account Setup** page (or any form with address autocomplete)
2. Type an address (e.g., "New Street, Birmingham, UK")
3. You should see:
   - ✅ Address suggestions appear in a dropdown
   - ✅ Selecting an address auto-fills: **City, State, Zip Code**
   - ✅ No console errors or warnings

## Troubleshooting

### "Mapbox API key not configured" message

- ✅ Check that `NEXT_PUBLIC_MAPBOX_API_KEY` is set in `.env.local` (local) or Vercel (production)
- ✅ Restart dev server after adding to `.env.local`
- ✅ Redeploy after adding to Vercel

### Address suggestions not appearing

- ✅ Check browser console (F12) for errors
- ✅ Verify API key starts with `pk.` (public token)
- ✅ Check Mapbox account dashboard for usage/quota limits
- ✅ Ensure you have internet connection

### City/State/Zip not auto-filling

- ✅ Check browser console logs - they show what Mapbox returns
- ✅ Some addresses may not have all components (especially international)
- ✅ The component falls back to parsing from the formatted address

## API Usage & Pricing

- **Free Tier:** 100,000 requests/month
- **Paid Plans:** Start at $5/month for 100k+ requests
- **Billing:** Pay-as-you-go after free tier
- **Documentation:** [https://docs.mapbox.com/api/search/geocoding/](https://docs.mapbox.com/api/search/geocoding/)

## Migration Notes

The old `GooglePlacesAutocomplete` component is still available for backward compatibility, but new forms use `MapboxAddressAutocomplete`.

To migrate other forms:
1. Replace import: `GooglePlacesAutocomplete` → `MapboxAddressAutocomplete`
2. Component API is identical - no other changes needed!

