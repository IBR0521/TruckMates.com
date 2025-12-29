# Environment Setup Required

Before the app can run, you need to create a `.env` file with your API credentials.

## Quick Setup

1. Create `.env` file in `truckmates-eld-mobile/` directory:

```env
API_BASE_URL=http://localhost:3000/api
SUPABASE_URL=your-supabase-url-here
SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

2. Replace the values:
   - Get `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project (Settings → API)
   - Set `API_BASE_URL` to your TruckMates platform URL

3. Save the file

4. Restart Metro bundler if it's running

## To Run the App

### Option 1: From Xcode (Easiest)
1. Open `ios/TruckMatesELD.xcworkspace` (or `.xcodeproj`) in Xcode
2. Select a simulator (iPhone 14, iPhone 15, etc.)
3. Click the Play button or press Cmd+R

### Option 2: From Terminal
```bash
# Start Metro bundler (if not already running)
npm start

# In another terminal, run iOS
npm run ios

# Or for Android
npm run android
```

## Troubleshooting

- **No simulator found**: Open Simulator app first (Xcode → Open Developer Tool → Simulator)
- **CocoaPods error**: Run `cd ios && pod install && cd ..`
- **Build errors**: Clean build folder in Xcode (Product → Clean Build Folder)

