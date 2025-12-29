# Fix for TSBackgroundFetch Undefined Symbol Error

## Problem
The error `Undefined symbol: _OBJC_CLASS_$_TSBackgroundFetch` means the `react-native-background-geolocation` library isn't properly linked.

## Solution: Check Xcode Build Settings

The library needs to be properly linked in Xcode. Here's how to fix it:

### Step 1: Check Frameworks are Linked

1. In Xcode, select the **TruckMatesELD** project (blue icon)
2. Select the **TruckMatesELD** target
3. Go to **Build Phases** tab
4. Expand **"Link Binary With Libraries"**
5. Make sure these frameworks are listed:
   - `TSLocationManager.framework`
   - `TSBackgroundFetch.framework`
   - `RNBackgroundGeolocation`

If they're missing, click **+** and add them.

### Step 2: Check Pod Installation

Make sure the pod was installed correctly. Run in Terminal:

```bash
cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design-1/truckmates-eld-mobile/ios"
export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/lib/ruby/gems/3.4.0/bin:$PATH"
pod install
```

### Step 3: Clean and Rebuild

1. In Xcode: **Product** → **Clean Build Folder** (Shift+Cmd+K)
2. Close Xcode
3. Delete DerivedData:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/TruckMatesELD-*
   ```
4. Reopen Xcode and build again

---

## Alternative: Remove Background Geolocation (If Not Needed Yet)

If you don't need background location tracking immediately, you can temporarily remove it:

1. Remove from `package.json`:
   ```json
   "react-native-background-geolocation": "^4.13.1"
   ```

2. Remove from code (in `locationService.ts`)

3. Run:
   ```bash
   npm install
   cd ios && pod install
   ```

---

**For now, try Step 1 first - check if the frameworks are linked in Xcode!**

