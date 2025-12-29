# Setup Guide for TruckMates ELD Mobile App

This guide will help you set up and run the TruckMates ELD mobile app on your development machine.

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **React Native CLI**
   ```bash
   npm install -g react-native-cli
   ```

3. **Watchman** (Recommended for macOS/Linux)
   ```bash
   # macOS
   brew install watchman
   
   # Linux (Ubuntu/Debian)
   sudo apt-get install watchman
   ```

### iOS Development (macOS only)

1. **Xcode** (14+)
   - Download from Mac App Store
   - Install Xcode Command Line Tools:
     ```bash
     xcode-select --install
     ```
   - Install CocoaPods:
     ```bash
     sudo gem install cocoapods
     ```

2. **iOS Simulator**
   - Included with Xcode
   - Launch from Xcode → Open Developer Tool → Simulator

### Android Development

1. **Android Studio**
   - Download from [developer.android.com](https://developer.android.com/studio)
   - Install Android SDK (API Level 33+)
   - Install Android Virtual Device (AVD)

2. **Environment Variables**
   ```bash
   # Add to ~/.bash_profile or ~/.zshrc
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

---

## Initial Setup

### 1. Clone/Navigate to Project

```bash
cd truckmates-eld-mobile
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Install iOS Dependencies (iOS only)

```bash
cd ios
pod install
cd ..
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
API_BASE_URL=https://your-truckmates-platform.com/api
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
APP_NAME=TruckMates ELD
APP_VERSION=1.0.0
LOCATION_UPDATE_INTERVAL=30000
LOCATION_ACCURACY=high
ENABLE_BACKGROUND_TRACKING=true
SYNC_INTERVAL=60000
OFFLINE_QUEUE_SIZE=1000
```

**Important:** Replace placeholders with your actual values:
- Get Supabase URL and key from your Supabase project settings
- Set API_BASE_URL to your TruckMates platform URL

### 5. Install React Native Dependencies

Some packages require additional setup:

#### For Location Services

**iOS:** Already configured in `Info.plist`

**Android:** Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

---

## Running the App

### iOS

1. **Start Metro Bundler:**
   ```bash
   npm start
   # or
   yarn start
   ```

2. **Run on iOS Simulator:**
   ```bash
   npm run ios
   # or
   yarn ios
   ```

3. **Run on Physical Device:**
   - Connect iPhone via USB
   - Trust computer on iPhone
   - Select device in Xcode
   - Run from Xcode or use: `npx react-native run-ios --device`

### Android

1. **Start Android Emulator:**
   - Open Android Studio
   - Tools → Device Manager → Start emulator

2. **Start Metro Bundler:**
   ```bash
   npm start
   ```

3. **Run on Android:**
   ```bash
   npm run android
   # or
   yarn android
   ```

---

## Development Workflow

### Debugging

**iOS:**
- Press `Cmd + D` in simulator to open debug menu
- Use Chrome DevTools or React Native Debugger

**Android:**
- Press `Cmd + M` (Mac) or `Ctrl + M` (Windows/Linux) to open debug menu
- Use Chrome DevTools

### Hot Reload

- Enabled by default
- Press `r` in Metro bundler terminal to reload
- Press `Cmd + R` (iOS) or `R` twice (Android) to reload

### Clearing Cache

If you encounter issues:

```bash
# Clear Metro bundler cache
npm start -- --reset-cache

# iOS: Clear build
cd ios && xcodebuild clean && cd ..

# Android: Clean build
cd android && ./gradlew clean && cd ..
```

---

## Project Structure

```
truckmates-eld-mobile/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   ├── services/         # API & business logic
│   │   ├── api.ts        # API client
│   │   ├── locationService.ts
│   │   ├── hosService.ts
│   │   └── syncService.ts
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   ├── constants/        # App constants
│   └── navigation/       # Navigation setup
├── android/              # Android native code
├── ios/                  # iOS native code
└── assets/               # Images, fonts, etc.
```

---

## Common Issues

### Issue: Metro bundler won't start

**Solution:**
```bash
# Kill existing node processes
killall node

# Clear cache and restart
npm start -- --reset-cache
```

### Issue: iOS build fails

**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Issue: Android build fails

**Solution:**
```bash
cd android
./gradlew clean
cd ..
```

### Issue: Location permissions not working

**iOS:**
- Check `Info.plist` has location permission descriptions
- Reset simulator: Device → Erase All Content and Settings

**Android:**
- Check `AndroidManifest.xml` has permissions
- Grant permissions manually in device settings

### Issue: Cannot connect to API

**Solution:**
- Verify `.env` file has correct API_BASE_URL
- Check network connectivity
- Verify Supabase credentials are correct
- Check if API server is running

---

## Testing Checklist

Before deploying, test:

- [ ] App launches without errors
- [ ] Login with valid credentials works
- [ ] Device registration completes successfully
- [ ] Location tracking starts and updates
- [ ] HOS status changes correctly
- [ ] Logs are created and displayed
- [ ] Data syncs to platform when online
- [ ] Offline mode queues data correctly
- [ ] App works in background (location tracking)
- [ ] Permissions are requested correctly

---

## Next Steps

1. Review the code and customize as needed
2. Test on physical devices
3. Configure for production (see `DEPLOYMENT.md`)
4. Build release versions
5. Submit to app stores

---

## Support

For issues or questions:
1. Check this guide first
2. Review React Native documentation
3. Check project README.md
4. Contact development team

Good luck with your development! 🚀

