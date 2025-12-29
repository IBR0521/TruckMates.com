# TruckMates ELD Mobile App

A React Native mobile application that functions as an Electronic Logging Device (ELD) for truck drivers, integrating with the TruckMates platform.

## Features

- 📍 Real-time GPS tracking with background location services
- ⏱️ Hours of Service (HOS) tracking and compliance
- 🚨 Violation detection and alerts
- 📊 Automatic log creation based on driving status
- 🔄 Offline capability with sync when online
- 👤 Driver authentication via TruckMates account
- 🚛 Truck assignment and management

## Prerequisites

- Node.js 18+ and npm/yarn
- React Native CLI (`npm install -g react-native-cli`)
- iOS Development: Xcode 14+ (Mac only)
- Android Development: Android Studio with Android SDK
- Expo CLI (optional, if using Expo) or React Native CLI

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Configure API endpoint:**
   
   Create a `.env` file in the root directory:
   ```env
   API_BASE_URL=https://your-truckmates-platform.com/api
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Run on iOS:**
   ```bash
   npm run ios
   # or
   yarn ios
   ```

4. **Run on Android:**
   ```bash
   npm run android
   # or
   yarn android
   ```

## Project Structure

```
truckmates-eld-mobile/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   ├── services/         # API services and business logic
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── constants/        # App constants
│   └── navigation/       # Navigation setup
├── android/              # Android native code
├── ios/                  # iOS native code
├── assets/               # Images, fonts, etc.
└── __tests__/            # Tests
```

## Building for Production

### iOS

1. Update version in `ios/TruckMatesELD/Info.plist`
2. Build archive in Xcode
3. Upload to App Store Connect

### Android

1. Update version in `android/app/build.gradle`
2. Generate release APK/AAB:
   ```bash
   cd android && ./gradlew assembleRelease
   # or for AAB (required for Play Store):
   ./gradlew bundleRelease
   ```

## Deployment to App Stores

See `DEPLOYMENT.md` for detailed instructions on deploying to:
- Apple App Store
- Google Play Store

## API Integration

The app communicates with TruckMates platform via these endpoints:

- `POST /api/eld/mobile/register` - Register device
- `POST /api/eld/mobile/locations` - Send GPS locations
- `POST /api/eld/mobile/logs` - Send HOS logs
- `POST /api/eld/mobile/events` - Send events/violations

All endpoints require authentication via Supabase Auth token.

## License

Proprietary - All rights reserved

