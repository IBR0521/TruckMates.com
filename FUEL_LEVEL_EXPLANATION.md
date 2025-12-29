# Fuel Level Update Behavior

## ✅ **Current Implementation (Correct)**

Fuel level is **NOT** automatically updated every 30 seconds. Here's how it actually works:

### **When Fuel Level Updates:**

1. **Manual Edit** - User edits vehicle and updates fuel level field
   - Location: `app/actions/trucks.ts` → `updateTruck()`
   - Triggered by: User action in vehicle edit form

2. **Initial Creation** - When vehicle is first created
   - Location: `app/actions/trucks.ts` → `createTruck()`
   - Triggered by: User action in add vehicle form

### **When Fuel Level Does NOT Update:**

1. ❌ **Fleet Map Refresh** - Every 30 seconds
   - The fleet map only **READS** fuel level from database
   - It does **NOT** write/update fuel level
   - The 30-second interval is only for GPS location tracking

2. ❌ **Vehicle List Page** - When vehicles are displayed
   - Only reads current fuel level value
   - No automatic updates

3. ❌ **Fuel Expenses** - When fuel expenses are logged
   - Currently does NOT automatically update fuel level
   - Could be added as optional feature in the future

### **Code Evidence:**

**Fleet Map** (`app/dashboard/fleet-map/page.tsx`):
```typescript
// Line 30: Only refreshes location data
const interval = setInterval(loadFleetData, 30000)

// Line 52-60: Only SELECTS data, doesn't UPDATE
const { data: trucksData } = await supabase
  .from("trucks")
  .select("*")  // ← Only reading, not updating
  .eq("company_id", userData.company_id)
```

**Fuel Level Updates** (`app/actions/trucks.ts`):
```typescript
// Line 172: Only updates when explicitly provided
if (formData.fuel_level !== undefined) 
  updateData.fuel_level = formData.fuel_level || null
```

---

## 🔄 **30-Second Refresh is ONLY For:**

1. ✅ **GPS Locations** - Real-time vehicle positions from ELD devices
2. ✅ **Vehicle Status** - In-use, available, maintenance, etc.
3. ✅ **Driver Assignments** - Current driver assignments
4. ✅ **Speed & Heading** - Real-time movement data

**NOT for:**
- ❌ Fuel level (static until manually changed)
- ❌ Mileage (static until manually changed)
- ❌ Vehicle specs (make, model, year, etc.)
- ❌ License/insurance dates

---

## ✅ **Auto-Update Feature (IMPLEMENTED)**

Fuel level now automatically updates when fuel expenses are logged!

### **How It Works:**

1. **When creating a fuel expense:**
   - Select "Fuel" as category
   - Select a truck
   - "Fuel Level After Fill (%)" field appears
   - Defaults to 100% (full tank) automatically
   - User can change if it's a partial fill

2. **When expense is saved:**
   - Truck's fuel level is automatically updated to the value entered
   - No need to manually edit vehicle separately
   - One-step process - log expense, fuel level updates automatically!

### **User Experience:**
- ✅ **Smart Default:** Auto-fills to 100% (assumes full tank)
- ✅ **Flexible:** User can change if it's a partial fill
- ✅ **Automatic:** No separate vehicle edit needed
- ✅ **Only for fuel:** Field only appears for fuel expenses with truck selected

---

## 💡 **Future Enhancement Options:**

1. **ELD Device Integration**
   - If ELD device reports fuel level (some do)
   - Sync when ELD data is synced (not every 30 seconds)
   - Would require ELD provider API support

2. **Fuel Level Calculation**
   - Calculate based on gallons purchased + current level + tank capacity
   - Would require storing tank capacity per vehicle

---

## ✅ **Current Status: Working Correctly**

The platform correctly:
- ✅ Only updates fuel level when manually edited
- ✅ Only refreshes GPS location every 30 seconds
- ✅ Does NOT waste resources updating static data unnecessarily
- ✅ Maintains data accuracy (no false updates)

**Your observation was correct to question it, but the implementation is actually correct!** 👍

