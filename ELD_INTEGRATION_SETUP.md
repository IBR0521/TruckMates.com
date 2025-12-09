# ELD Real Integration Setup Guide

## 🎯 What You Need to Provide

To make ELD work like real ELD devices, you need to provide:

### 1. **ELD Provider Account** 📱

Choose one or more ELD providers:
- **KeepTruckin** (Recommended - easiest to integrate)
- **Samsara** (Enterprise solution)
- **Geotab** (Fleet management)
- **Rand McNally** (Other option)

### 2. **API Credentials** 🔑

For each provider, you'll need:

#### KeepTruckin:
- **API Key** (X-Api-Key)
- **API Secret** (X-Api-Secret)
- **📖 Step-by-step guide**: See `HOW_TO_GET_ELD_API_CREDENTIALS.md`
- **⚡ Quick start**: See `QUICK_START_ELD_API.md` (5 minutes)
- Get from: https://developer.keeptruckin.com/

#### Samsara:
- **API Key** (Bearer token)
- **📖 Step-by-step guide**: See `HOW_TO_GET_ELD_API_CREDENTIALS.md`
- Get from: https://developers.samsara.com/

#### Geotab:
- **Username** (for MyGeotab)
- **Password** (for MyGeotab)
- **📖 Step-by-step guide**: See `HOW_TO_GET_ELD_API_CREDENTIALS.md`
- Get from: https://developers.geotab.com/

### 3. **Device Information** 📋

For each ELD device:
- **Device Serial Number**
- **Provider Device ID** (from provider's system)
- **Truck ID** (link to your truck in the system)

---

## 📚 **NEW: Detailed Step-by-Step Guides**

I've created comprehensive guides to help you get API credentials:

1. **`HOW_TO_GET_ELD_API_CREDENTIALS.md`** - Complete step-by-step guide for all providers
2. **`QUICK_START_ELD_API.md`** - Fast 5-minute setup for KeepTruckin

**Start with the Quick Start guide if you want to get set up fast!** ⚡

---

## 🚀 Setup Steps

### Step 1: Sign Up with ELD Provider

1. Go to provider's website
2. Create account
3. Register your application
4. Get API credentials

### Step 2: Add Devices in Your SaaS

1. Go to **ELD Service** → **Add ELD Device**
2. Fill in:
   - Device Name (e.g., "Truck #1 ELD")
   - Serial Number
   - Provider (KeepTruckin, Samsara, etc.)
   - **Provider Device ID** (from provider dashboard)
   - **API Key** (from provider)
   - **API Secret** (if required)
   - Link to Truck
3. Save device

### Step 3: Test Sync

1. Go to device details
2. Click **"Sync Now"** button
3. Check if data appears in logs/locations/events

### Step 4: Set Up Automatic Sync

#### Option A: Vercel Cron (Recommended)

1. Add to `vercel.json` (already done):
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-eld",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

2. Set environment variable in Vercel:
   - `CRON_SECRET` = any random string (for security)

3. Deploy to Vercel - cron will run automatically every 15 minutes

#### Option B: External Cron Service

Use services like:
- **cron-job.org** (free)
- **EasyCron** (paid)
- **GitHub Actions** (free)

Set up to call: `https://your-domain.com/api/cron/sync-eld`

---

## 📝 What I've Created

### 1. **ELD Sync Functions** (`app/actions/eld-sync.ts`)
- `syncKeepTruckinData()` - Syncs from KeepTruckin API
- `syncSamsaraData()` - Syncs from Samsara API
- `syncGeotabData()` - Syncs from Geotab API
- `syncELDDevice()` - Main sync function
- `syncAllELDDevices()` - Syncs all active devices

### 2. **Cron Endpoint** (`app/api/cron/sync-eld/route.ts`)
- API endpoint for automatic syncing
- Can be called by Vercel Cron or external services
- Protected with CRON_SECRET

### 3. **Vercel Cron Config** (`vercel.json`)
- Automatic sync every 15 minutes
- Runs in background

### 4. **Updated ELD Actions** (`app/actions/eld.ts`)
- Added `syncELDData()` function
- Can be called manually from UI

---

## 🔧 How It Works

### Data Flow:

```
ELD Device (in Truck)
    ↓
Provider Cloud (KeepTruckin/Samsara/Geotab)
    ↓
Your SaaS API (via provider API)
    ↓
Sync Function (app/actions/eld-sync.ts)
    ↓
Your Database (Supabase)
    ↓
Your Dashboard (displays data)
```

### Automatic Sync:

1. **Cron Job** runs every 15 minutes
2. Calls `/api/cron/sync-eld`
3. Syncs all active ELD devices
4. Pulls latest logs, locations, events
5. Stores in database
6. Updates device `last_sync_at` timestamp

---

## 🧪 Testing

### Test Manual Sync:

1. Go to ELD Service
2. Click on a device
3. Click "Sync Now" button
4. Check if data appears

### Test Automatic Sync:

1. Wait 15 minutes after deployment
2. Check device `last_sync_at` timestamp
3. Verify new data in logs/locations/events

### Test API Directly:

```bash
curl -X GET https://your-domain.com/api/cron/sync-eld \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## ⚠️ Important Notes

### API Rate Limits:

- **KeepTruckin**: 100 requests/minute
- **Samsara**: Varies by plan
- **Geotab**: 10 requests/second

The sync runs every 15 minutes to avoid rate limits.

### Security:

- **Never commit API keys** to git
- Store in environment variables
- Use `CRON_SECRET` to protect cron endpoint
- Encrypt sensitive data in database

### Error Handling:

- Sync errors are logged to console
- Failed syncs don't stop other devices
- Check device status if sync fails repeatedly

---

## 📊 What Data Gets Synced

### 1. **HOS Logs** (Hours of Service)
- Driving time
- On-duty time
- Off-duty time
- Sleeper berth time
- Start/end locations
- Miles driven
- Engine hours

### 2. **GPS Locations**
- Real-time location
- Speed
- Heading
- Odometer
- Engine status

### 3. **Events/Violations**
- HOS violations
- Speeding events
- Hard braking
- Hard acceleration
- Device malfunctions

---

## 🆘 Troubleshooting

### "API credentials not configured"
- Make sure API Key and Secret are entered in device settings
- Check credentials are correct

### "Provider not yet supported"
- Only KeepTruckin, Samsara, and Geotab are implemented
- Other providers need custom integration

### "Sync failed"
- Check API credentials are valid
- Verify Provider Device ID is correct
- Check provider API status
- Review error logs in console

### "No data synced"
- Verify device is linked to truck
- Check date range (some providers limit historical data)
- Ensure device is active in provider's system

---

## 🎯 Next Steps

1. ✅ **Get API credentials** from ELD provider
2. ✅ **Add devices** with API credentials
3. ✅ **Test manual sync** from UI
4. ✅ **Deploy to Vercel** (cron will start automatically)
5. ✅ **Monitor sync** in dashboard

---

## 📚 Provider Documentation

- **KeepTruckin**: https://developer.keeptruckin.com/docs
- **Samsara**: https://developers.samsara.com/docs
- **Geotab**: https://developers.geotab.com/docs

---

**Once you provide API credentials and add devices, the ELD service will work exactly like real ELD devices!** 🚀

