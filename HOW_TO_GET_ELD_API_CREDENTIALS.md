# How to Get ELD API Credentials - Step by Step Guide

## 🎯 Quick Overview

This guide will walk you through getting API credentials from the most popular ELD providers. We'll start with **KeepTruckin** (easiest), then cover Samsara and Geotab.

---

## 📱 Option 1: KeepTruckin (RECOMMENDED - Easiest)

### Step 1: Sign Up for KeepTruckin Account

1. Go to **https://keeptruckin.com**
2. Click **"Get Started"** or **"Sign Up"**
3. Fill in your information:
   - Company name
   - Email address
   - Phone number
   - Number of vehicles
4. Complete the signup process
5. Verify your email address

### Step 2: Access Developer Portal

1. Go to **https://developer.keeptruckin.com/**
2. Click **"Sign In"** (top right)
3. Log in with your KeepTruckin account credentials
4. If you don't have a developer account, click **"Sign Up"** and create one

### Step 3: Create an Application

1. Once logged in, go to **"My Apps"** or **"Applications"**
2. Click **"Create New App"** or **"New Application"**
3. Fill in the application details:
   - **App Name**: "TruckMates Logistics" (or your company name)
   - **Description**: "Logistics management system integration"
   - **Redirect URI**: `https://your-domain.com/callback` (optional, can be your website)
   - **App Type**: Select **"Server-side"** or **"API Access"**
4. Click **"Create"** or **"Submit"**

### Step 4: Get API Credentials

1. After creating the app, you'll see your credentials:
   - **API Key** (also called "Client ID" or "X-Api-Key")
   - **API Secret** (also called "Client Secret" or "X-Api-Secret")
2. **IMPORTANT**: Copy these immediately - you won't be able to see the secret again!
3. Save them securely (we'll use them in the next step)

### Step 5: Get Device IDs

1. Log in to your **KeepTruckin dashboard** (not developer portal)
2. Go to **"Fleet"** → **"Vehicles"** or **"Devices"**
3. Click on each vehicle/device
4. Find the **"Device ID"** or **"Vehicle ID"** (usually a number)
5. Note this down - this is your **Provider Device ID**

### Step 6: Add to Your SaaS

1. Go to your SaaS → **ELD Service** → **Add ELD Device**
2. Fill in:
   - **Device Name**: "Truck #1 ELD" (or descriptive name)
   - **Serial Number**: Device serial number (from KeepTruckin)
   - **Provider**: Select **"keeptruckin"**
   - **Provider Device ID**: The Device ID from Step 5
   - **API Key**: The API Key from Step 4
   - **API Secret**: The API Secret from Step 4
   - **Truck**: Link to your truck in the system
3. Click **"Save"**

### Step 7: Test Connection

1. Click on the device you just added
2. Click **"Sync Now"** button
3. If successful, you should see data appear in logs/locations/events
4. If it fails, check:
   - API Key and Secret are correct
   - Device ID is correct
   - Your KeepTruckin account has active devices

---

## 🚛 Option 2: Samsara

### Step 1: Sign Up for Samsara

1. Go to **https://www.samsara.com**
2. Click **"Get Started"** or **"Request Demo"**
3. Fill in your information
4. Complete the signup process
5. Verify your account

### Step 2: Access API Settings

1. Log in to your **Samsara dashboard**
2. Go to **Settings** → **API** or **Integrations** → **API**
3. If you don't see API settings, you may need to:
   - Contact Samsara support to enable API access
   - Upgrade to a plan that includes API access

### Step 3: Create API Token

1. In the API settings page, click **"Create API Token"** or **"Generate Token"**
2. Give it a name: "TruckMates Integration"
3. Select permissions:
   - **Read Vehicles**
   - **Read Locations**
   - **Read HOS Logs**
   - **Read Events**
4. Click **"Generate"** or **"Create"**

### Step 4: Copy API Token

1. You'll see your **API Token** (this is your API Key)
2. **IMPORTANT**: Copy it immediately - you won't see it again!
3. Save it securely

### Step 5: Get Vehicle IDs

1. In Samsara dashboard, go to **Fleet** → **Vehicles**
2. Click on each vehicle
3. Find the **"Vehicle ID"** (usually in the URL or vehicle details)
4. Note this down - this is your **Provider Device ID**

### Step 6: Add to Your SaaS

1. Go to your SaaS → **ELD Service** → **Add ELD Device**
2. Fill in:
   - **Device Name**: "Truck #1 ELD"
   - **Serial Number**: Device serial number
   - **Provider**: Select **"samsara"**
   - **Provider Device ID**: Vehicle ID from Step 5
   - **API Key**: The API Token from Step 4
   - **API Secret**: Leave empty (Samsara uses token only)
   - **Truck**: Link to your truck
3. Click **"Save"**

---

## 🗺️ Option 3: Geotab

### Step 1: Sign Up for Geotab

1. Go to **https://www.geotab.com**
2. Click **"Get Started"** or **"Request Demo"**
3. Fill in your information
4. Complete the signup process
5. Verify your account

### Step 2: Access MyGeotab

1. Log in to **https://my.geotab.com**
2. This is your Geotab dashboard

### Step 3: Get Database Name

1. In MyGeotab, look at the URL
2. It will be like: `https://[database].geotab.com`
3. The `[database]` part is your **Database Name**
4. Note this down

### Step 4: Create API User

1. Go to **Administration** → **Users** → **Add User**
2. Create a new user for API access:
   - **Username**: "api_user" (or any name)
   - **Password**: Create a strong password
   - **Role**: Select **"API User"** or **"Administrator"**
3. Save the username and password

### Step 5: Get Device IDs

1. Go to **Fleet** → **Vehicles** or **Devices**
2. Click on each device
3. Find the **"Device ID"** (usually a long number)
4. Note this down - this is your **Provider Device ID**

### Step 6: Add to Your SaaS

1. Go to your SaaS → **ELD Service** → **Add ELD Device**
2. Fill in:
   - **Device Name**: "Truck #1 ELD"
   - **Serial Number**: Device serial number
   - **Provider**: Select **"geotab"**
   - **Provider Device ID**: Your database name (from Step 3)
   - **API Key**: Username from Step 4
   - **API Secret**: Password from Step 4
   - **Truck**: Link to your truck
3. Click **"Save"**

---

## 🔐 Security Best Practices

### 1. Store Credentials Securely

- **Never** commit API keys to git
- Store in environment variables
- Use a password manager
- Don't share credentials via email/chat

### 2. Use Environment Variables

In your `.env.local` (for development):
```env
KEEPTRUCKIN_API_KEY=your_key_here
KEEPTRUCKIN_API_SECRET=your_secret_here
```

In Vercel (for production):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each credential as a separate variable
3. Mark as "Production", "Preview", and "Development"

### 3. Rotate Credentials Regularly

- Change API keys every 90 days
- Revoke old keys when creating new ones
- Update in your SaaS immediately

---

## ✅ Verification Checklist

Before testing, make sure you have:

- [ ] API Key (from provider)
- [ ] API Secret (if required)
- [ ] Provider Device ID (for each device)
- [ ] Device Serial Number
- [ ] Device linked to truck in your system
- [ ] Credentials saved securely

---

## 🧪 Testing Your Integration

### Test 1: Manual Sync

1. Go to **ELD Service** → Click on a device
2. Click **"Sync Now"** button
3. Wait a few seconds
4. Check if data appears:
   - Go to **Logs** tab - should see HOS logs
   - Go to **Locations** tab - should see GPS data
   - Go to **Events** tab - should see violations/events

### Test 2: Check Device Status

1. Device should show **"Active"** status
2. **Last Sync** timestamp should update
3. No error messages in console

### Test 3: Verify Data

1. Check logs have:
   - Driving time
   - Location data
   - Miles driven
2. Check locations have:
   - GPS coordinates
   - Timestamps
   - Speed data
3. Check events have:
   - Violation types
   - Timestamps
   - Severity levels

---

## 🆘 Troubleshooting

### "API credentials not configured"
- Make sure API Key and Secret are entered
- Check for typos or extra spaces
- Verify credentials are saved

### "Authentication failed"
- API Key or Secret is incorrect
- Credentials may have expired
- Account may be suspended

### "Device not found"
- Provider Device ID is incorrect
- Device may not exist in provider's system
- Device may be inactive

### "No data synced"
- Device may not have recent activity
- Date range may be too narrow
- Provider API may have rate limits

### "Rate limit exceeded"
- Too many API calls
- Wait 15 minutes and try again
- Check provider's rate limits

---

## 📞 Getting Help

### KeepTruckin Support
- **Email**: support@keeptruckin.com
- **Phone**: 1-855-434-3564
- **Docs**: https://developer.keeptruckin.com/docs

### Samsara Support
- **Email**: support@samsara.com
- **Phone**: 1-844-4-SAMSARA
- **Docs**: https://developers.samsara.com/docs

### Geotab Support
- **Email**: support@geotab.com
- **Phone**: 1-519-622-4300
- **Docs**: https://developers.geotab.com/docs

---

## 🎯 Quick Reference

### KeepTruckin
- **Developer Portal**: https://developer.keeptruckin.com/
- **API Docs**: https://developer.keeptruckin.com/docs
- **Credentials**: API Key + API Secret
- **Device ID**: From Fleet → Vehicles

### Samsara
- **Dashboard**: https://cloud.samsara.com
- **API Docs**: https://developers.samsara.com/docs
- **Credentials**: API Token (Bearer token)
- **Device ID**: Vehicle ID from Fleet

### Geotab
- **Dashboard**: https://my.geotab.com
- **API Docs**: https://developers.geotab.com/docs
- **Credentials**: Username + Password
- **Device ID**: Database name + Device ID

---

## 📝 Next Steps

1. ✅ Choose a provider (KeepTruckin recommended)
2. ✅ Get API credentials (follow steps above)
3. ✅ Add devices to your SaaS
4. ✅ Test manual sync
5. ✅ Deploy to production
6. ✅ Automatic sync will start (every 15 minutes)

---

**Once you have the API credentials, the ELD service will automatically pull real data from your devices!** 🚀

