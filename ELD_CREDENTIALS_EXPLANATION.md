# ELD Device Credentials - Complete Explanation

## What Are ELD Device Credentials?

**ELD Device Credentials** are **NOT** the same as platform API keys (like Google Maps or Resend). These are **per-device credentials** that each customer enters when they add their ELD (Electronic Logging Device) hardware to the TruckMates platform.

---

## Two Types of API Keys

### 1. **Platform API Keys** (You Already Have These ✅)
These are **platform-wide** keys that you (the platform owner) configure once:

- ✅ **Google Maps API Key** - For route optimization (you already have this)
- ✅ **Resend API Key** - For email notifications (you already have this)
- ✅ **OpenAI/Gemini API Key** - For document analysis
- ✅ **Twilio Credentials** - For SMS (optional)

**Where:** Stored in `.env.local` as environment variables  
**Who Uses:** All users on the platform automatically  
**Status:** ✅ You already provided these!

---

### 2. **ELD Device Credentials** (Per-Customer, Per-Device)
These are **customer-specific** credentials that each customer enters when adding their ELD hardware:

- **KeepTruckin API Key + Secret** - Customer gets from their KeepTruckin account
- **Samsara API Key** - Customer gets from their Samsara account
- **Geotab Username + Password** - Customer's Geotab login
- **Rand McNally Credentials** - Customer gets from their Rand McNally account

**Where:** Stored per-device in `eld_devices` table (encrypted)  
**Who Uses:** Only that specific customer's device  
**Status:** ❌ Customers enter these themselves when adding devices

---

## How ELD Device Credentials Work

### Step 1: Customer Adds ELD Device
When a customer wants to connect their ELD hardware (like KeepTruckin, Samsara, etc.), they:

1. Go to `/dashboard/eld/devices`
2. Click "Add Device"
3. Select their ELD provider (KeepTruckin, Samsara, Geotab, etc.)
4. Enter their **device-specific credentials**:
   - **KeepTruckin**: API Key + API Secret (from their KeepTruckin dashboard)
   - **Samsara**: API Key/Bearer Token (from their Samsara dashboard)
   - **Geotab**: Username + Password (their Geotab login)
   - **Rand McNally**: API credentials (from their Rand McNally account)

### Step 2: System Stores Credentials
- Credentials are stored in `eld_devices` table
- Encrypted for security
- Linked to that specific device and customer

### Step 3: System Syncs Data
- TruckMates uses those credentials to call the ELD provider's API
- Syncs HOS logs, GPS locations, violations
- Data appears in TruckMates dashboard

---

## Example: KeepTruckin Integration

### What Customer Needs:
1. **KeepTruckin Account** - They already have this (they use KeepTruckin hardware)
2. **KeepTruckin API Credentials**:
   - Go to KeepTruckin Dashboard → Settings → API
   - Generate API Key and API Secret
   - Copy both values

### What Customer Enters in TruckMates:
- Device Name: "Truck 1 - KeepTruckin"
- Provider: "KeepTruckin"
- API Key: `kt_abc123xyz...` (from KeepTruckin)
- API Secret: `kt_secret_xyz789...` (from KeepTruckin)
- Device ID: `12345` (KeepTruckin device serial number)

### What Happens:
- TruckMates stores these credentials (encrypted)
- Every 15 minutes, TruckMates calls KeepTruckin API using these credentials
- Syncs HOS logs, GPS locations, violations
- Data appears in TruckMates dashboard

---

## Supported ELD Providers

### 1. **KeepTruckin**
**Credentials Needed:**
- API Key (`api_key`)
- API Secret (`api_secret`)

**How Customer Gets Them:**
1. Log in to KeepTruckin dashboard
2. Settings → API
3. Generate credentials

**What Gets Synced:**
- HOS logs (driving, on-duty, off-duty, sleeper)
- GPS locations
- Violations and events

---

### 2. **Samsara**
**Credentials Needed:**
- API Key (Bearer token)

**How Customer Gets Them:**
1. Log in to Samsara dashboard
2. Settings → API
3. Generate API key

**What Gets Synced:**
- HOS daily logs
- Vehicle locations
- Safety events

---

### 3. **Geotab**
**Credentials Needed:**
- Username (Geotab login)
- Password (Geotab password)
- Server URL (e.g., `https://my.geotab.com`)

**How Customer Gets Them:**
- Their existing Geotab login credentials
- Server URL from their MyGeotab dashboard

**What Gets Synced:**
- Log records
- Status data (locations)
- Fault data (events)

---

### 4. **Rand McNally**
**Credentials Needed:**
- API credentials (varies by Rand McNally product)

**How Customer Gets Them:**
- From their Rand McNally account/dashboard

---

### 5. **TruckMates Mobile App** (No Credentials Needed!)
**Special Case:**
- Uses Supabase Auth (no API credentials)
- Customer just logs in with their TruckMates account
- Device registered via mobile app
- No external API credentials required

---

## Where Credentials Are Stored

### Database Table: `eld_devices`
```sql
CREATE TABLE eld_devices (
  id UUID PRIMARY KEY,
  company_id UUID, -- Customer's company
  truck_id UUID, -- Which truck this device is in
  device_name TEXT,
  provider TEXT, -- 'keeptruckin', 'samsara', 'geotab', etc.
  api_key TEXT, -- ENCRYPTED - Customer's API key
  api_secret TEXT, -- ENCRYPTED - Customer's API secret
  provider_device_id TEXT, -- Device ID from provider
  ...
)
```

**Security:**
- Credentials are encrypted before storage
- Each customer only sees their own devices
- Platform never sees customer credentials in plain text

---

## Summary

### ✅ You Already Have (Platform Keys):
- Google Maps API Key ✅
- Resend API Key ✅
- These work for ALL users automatically

### ❌ Customers Provide (ELD Device Credentials):
- KeepTruckin API Key + Secret (per device)
- Samsara API Key (per device)
- Geotab Username + Password (per device)
- Rand McNally Credentials (per device)
- These are entered by customers when adding devices

### 🎯 Key Difference:
- **Platform API Keys** = You configure once, everyone uses
- **ELD Device Credentials** = Each customer enters their own (from their ELD provider account)

---

## For Your Status Report

**Update the report to clarify:**

1. **Google Maps & Resend** - ✅ Already configured (you have these)
2. **ELD Device Credentials** - ⚠️ Not needed by you - customers enter these themselves when adding devices

**The "ELD Device Credentials" section in the report should say:**
> "ELD device integration is fully implemented. Customers enter their own ELD provider credentials (KeepTruckin, Samsara, Geotab, etc.) when adding devices. No platform configuration needed."

---

**Bottom Line:** You don't need to provide ELD device credentials. Those are entered by customers when they connect their hardware. Your Google Maps and Resend API keys are already set up! ✅

