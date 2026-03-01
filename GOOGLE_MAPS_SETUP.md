# Google Maps API Setup Guide

## ⚠️ Map Not Loading? You Need a Google Maps API Key!

The map requires a Google Maps API key to function. Follow these steps:

## Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable these APIs:
   - **Maps JavaScript API** (Required for map display)
   - **Places API** (Optional, for address autocomplete)
   - **Directions API** (Optional, for route optimization)
   - **Geocoding API** (Optional, for address conversion)

4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **API Key**
6. Copy your API key

## Step 2: Configure API Key Restrictions (Recommended)

1. Click on your API key to edit it
2. Under **API restrictions**, select **Restrict key**
3. Select only the APIs you enabled:
   - Maps JavaScript API
   - Places API (if enabled)
   - Directions API (if enabled)
   - Geocoding API (if enabled)

4. Under **Application restrictions**, select **HTTP referrers (web sites)**
5. Add your domains:
   - `http://localhost:3000/*` (for development)
   - `https://yourdomain.com/*` (for production)

## Step 3: Add API Key to Your Project

1. Create a file named `.env.local` in the project root (if it doesn't exist)
2. Add this line:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
   Replace `your_api_key_here` with your actual API key

3. **Restart your development server** after adding the key:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

## Step 4: Verify It's Working

1. Open your browser's Developer Console (F12)
2. Look for messages starting with `[FleetMap]` or `[GeofenceDialog]`
3. The map should load within 2-3 seconds
4. If you see errors, check:
   - API key is correct
   - Maps JavaScript API is enabled
   - API key restrictions allow your domain
   - Server was restarted after adding the key

## Troubleshooting

### Map Still Not Loading?

1. **Check Browser Console (F12)**
   - Look for red error messages
   - Check for `[FleetMap]` or `[GeofenceDialog]` logs

2. **Verify API Key**
   - Make sure it starts with `AIza...`
   - Check it's not expired or disabled

3. **Check API Restrictions**
   - Make sure `http://localhost:3000/*` is allowed (for dev)
   - Make sure your production domain is allowed

4. **Verify API is Enabled**
   - Go to Google Cloud Console → APIs & Services → Enabled APIs
   - Make sure "Maps JavaScript API" is listed

5. **Check Network Tab**
   - Open browser DevTools → Network tab
   - Look for requests to `maps.googleapis.com`
   - Check if they return 200 OK or show errors

### Common Errors

**"Google Maps API key not configured"**
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env.local`
- Restart dev server

**"This API key is not authorized"**
- Enable "Maps JavaScript API" in Google Cloud Console
- Check API key restrictions

**"RefererNotAllowedMapError"**
- Add your domain to API key restrictions
- Include `http://localhost:3000/*` for development

**"Map container has no dimensions"**
- This is usually a CSS issue
- Check that the map container has width/height set

## Cost Information

Google Maps API has a free tier:
- **$200 free credit per month**
- Maps JavaScript API: Free for most use cases
- After free tier: ~$7 per 1,000 map loads

For most small-to-medium fleets, the free tier is sufficient.

## Need Help?

If the map still doesn't load after following these steps:
1. Check browser console for specific error messages
2. Verify your API key in Google Cloud Console
3. Make sure the dev server was restarted after adding the key

---

**Important**: Never commit your `.env.local` file to git! It contains sensitive API keys.













