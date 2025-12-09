# How ELD Service Finds and Connects to Devices

## 🔍 How It Works

Your ELD service **doesn't directly find devices**. Instead, it connects to the **ELD provider's API** (KeepTruckin, Samsara, etc.) which already has all the device data.

---

## 🔄 Connection Process

### Step 1: User Provides Device ID

When user adds a device, they provide:
- **Provider Device ID**: "123456" (from KeepTruckin/Samsara dashboard)
- **API Key**: Authentication key
- **API Secret**: Authentication secret

### Step 2: Your SaaS Calls Provider API

Your code uses the Device ID to request data:

```typescript
// Example: KeepTruckin API call
const response = await fetch(
  `https://api.keeptruckin.com/v1/logs?device_id=123456`,
  {
    headers: {
      'X-Api-Key': 'user_api_key',
      'X-Api-Secret': 'user_api_secret'
    }
  }
)
```

### Step 3: Provider Returns Device Data

The provider's API returns data for that Device ID:
- HOS logs
- GPS locations
- Events/violations

### Step 4: Your SaaS Stores Data

Your code stores the data in your database.

---

## 📡 How the Code Works

### The Connection Happens Here:

**File: `app/actions/eld-sync.ts`**

```typescript
// When user clicks "Sync Now" or automatic sync runs:

1. Gets device from database (with Device ID and API credentials)
   ↓
2. Calls provider API using Device ID:
   fetch(`https://api.keeptruckin.com/v1/logs?device_id=${device.provider_device_id}`)
   ↓
3. Provider API returns data for that Device ID
   ↓
4. Stores data in your database
```

### Example Flow:

```typescript
// User added device with:
// - Provider Device ID: "123456"
// - API Key: "abc123"
// - API Secret: "xyz789"

// Your code does:
const device = await getELDDevice(deviceId)
// device.provider_device_id = "123456"
// device.api_key = "abc123"
// device.api_secret = "xyz789"

// Then calls provider API:
const response = await fetch(
  `https://api.keeptruckin.com/v1/logs?device_id=123456`,
  {
    headers: {
      'X-Api-Key': 'abc123',
      'X-Api-Secret': 'xyz789'
    }
  }
)

// Provider returns data for device "123456"
// Your code stores it in database
```

---

## 🎯 What You Need to Do

### Nothing! It's Already Set Up ✅

The connection code is already in place:

1. **`app/actions/eld-sync.ts`** - Contains API connection code
2. **`app/actions/eld.ts`** - Contains device management
3. **`app/api/cron/sync-eld/route.ts`** - Automatic sync endpoint

### How It Finds Devices:

1. **User adds device** with Device ID and API credentials
2. **Your code stores** Device ID and credentials in database
3. **When syncing**, code:
   - Gets Device ID from database
   - Uses Device ID to call provider API
   - Provider API returns data for that Device ID
   - Code stores data in your database

---

## 🔧 Technical Details

### KeepTruckin Connection:

```typescript
// File: app/actions/eld-sync.ts

async function syncKeepTruckinData(device: any) {
  // device.provider_device_id = "123456" (from user)
  // device.api_key = "abc123" (from user)
  // device.api_secret = "xyz789" (from user)

  // Call KeepTruckin API with Device ID
  const logsResponse = await fetch(
    `https://api.keeptruckin.com/v1/logs?device_id=${device.provider_device_id}`,
    {
      headers: {
        'X-Api-Key': device.api_key,
        'X-Api-Secret': device.api_secret
      }
    }
  )

  // Provider returns data for device "123456"
  const logs = await logsResponse.json()
  
  // Store in your database
  await supabase.from('eld_logs').insert(logs)
}
```

### Samsara Connection:

```typescript
async function syncSamsaraData(device: any) {
  // Uses vehicleId (Device ID) to get data
  const response = await fetch(
    `https://api.samsara.com/fleet/vehicles/locations?vehicleIds=${device.provider_device_id}`,
    {
      headers: {
        'Authorization': `Bearer ${device.api_key}`
      }
    }
  )
  
  // Provider returns data for that vehicle
  const data = await response.json()
  
  // Store in your database
}
```

---

## 🧪 Testing the Connection

### Test 1: Manual Sync

1. User adds device with Device ID and API credentials
2. User clicks "Sync Now" button
3. Your code:
   - Gets Device ID from database
   - Calls provider API with Device ID
   - Provider returns data
   - Data appears in dashboard

### Test 2: Check API Call

You can test the API call directly:

```bash
# Test KeepTruckin API
curl -X GET \
  "https://api.keeptruckin.com/v1/logs?device_id=123456" \
  -H "X-Api-Key: your_api_key" \
  -H "X-Api-Secret: your_api_secret"
```

If this returns data, your connection works!

---

## 📋 What Happens Step-by-Step

### When User Adds Device:

```
1. User fills form:
   - Provider Device ID: "123456"
   - API Key: "abc123"
   - API Secret: "xyz789"

2. Your code saves to database:
   - eld_devices table
   - Stores Device ID and credentials

3. Device is now "connected" ✅
```

### When Sync Runs:

```
1. Code gets device from database
   - Reads Device ID: "123456"
   - Reads API Key: "abc123"
   - Reads API Secret: "xyz789"

2. Code calls provider API:
   GET https://api.keeptruckin.com/v1/logs?device_id=123456
   Headers: X-Api-Key: abc123, X-Api-Secret: xyz789

3. Provider API responds:
   - Returns data for device "123456"
   - Includes logs, locations, events

4. Code stores in your database:
   - eld_logs table
   - eld_locations table
   - eld_events table

5. Data appears in dashboard ✅
```

---

## ⚠️ Important Points

### 1. Device Must Be Registered with Provider

- Device must exist in provider's system
- Device must be active
- Provider must have data for that Device ID

### 2. API Credentials Must Be Valid

- API Key must be correct
- API Secret must be correct
- Credentials must have permission to access device data

### 3. Device ID Must Match

- Device ID must match provider's system
- Wrong Device ID = no data returned
- Device ID is unique per device

---

## 🔍 How to Verify Connection

### Check 1: Device Exists in Provider

1. User logs into provider dashboard (KeepTruckin/Samsara)
2. Checks if device "123456" exists
3. Checks if device is active
4. Checks if device has data

### Check 2: API Credentials Work

1. Test API call manually (see above)
2. If returns data, credentials work
3. If error, check credentials

### Check 3: Sync Works

1. User clicks "Sync Now"
2. Check if data appears
3. Check error messages if any

---

## 🎯 Summary

### How Your ELD Service "Finds" Devices:

1. **User provides Device ID** (from provider dashboard)
2. **Your code uses Device ID** to call provider API
3. **Provider API returns data** for that Device ID
4. **Your code stores data** in database

### What You Need to Do:

**Nothing!** The code is already set up. Just:
- ✅ User adds device with Device ID and API credentials
- ✅ Code automatically uses Device ID to fetch data
- ✅ Data appears in dashboard

### The "Finding" Happens Through:

- **Provider API** - Already knows about all devices
- **Device ID** - Used to request specific device data
- **API Credentials** - Used to authenticate the request

**Your SaaS doesn't scan for devices - it asks the provider API for data using the Device ID!** 🚀

