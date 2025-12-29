# Quick Fix for TSBackgroundFetch Linking Error

## The Issue
`Undefined symbol: _OBJC_CLASS_$_TSBackgroundFetch` means the background geolocation framework isn't linked.

## Quick Fix in Xcode

1. **In Xcode, select the project:**
   - Click on **TruckMatesELD** (blue icon) in the left sidebar
   - Select **TruckMatesELD** target (under TARGETS)

2. **Go to Build Phases tab:**
   - Click on **"Build Phases"** tab at the top

3. **Check "Link Binary With Libraries":**
   - Expand **"Link Binary With Libraries"** section
   - Look for `TSLocationManager.framework` or `RNBackgroundGeolocation`
   - If missing, click **+** button
   - Search for and add: `TSLocationManager.framework`
   - Also add: `TSBackgroundFetch.framework` if available

4. **Check "Copy Bundle Resources":**
   - Expand **"Copy Bundle Resources"** section
   - Make sure any `.bundle` files from RNBackgroundGeolocation are included

5. **Clean and Build:**
   - Product → Clean Build Folder (Shift+Cmd+K)
   - Build again (Cmd+R)

---

## Alternative: Temporarily Comment Out Background Geolocation

If the above doesn't work, you can temporarily remove it from `package.json` to get the app building, then add it back later when needed.

---

**Try Step 3 first - add the framework to Link Binary With Libraries in Xcode!**

