# Files to Copy for App Store Deployment

When you're ready to deploy the mobile app, you can copy the entire `truckmates-eld-mobile` folder to your deployment location or repository. This document lists all files that should be included.

## Essential Files (Must Include)

### Root Files
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `babel.config.js` - Babel configuration
- `index.js` - App entry point
- `app.json` - App metadata
- `.gitignore` - Git ignore rules
- `.env.example` - Environment variable template

### Documentation
- `README.md` - Project overview
- `SETUP.md` - Setup instructions
- `DEPLOYMENT.md` - Deployment guide
- `QUICK_START.md` - Quick start guide

### Source Code
- `src/` - Entire source directory
  - `App.tsx` - Main app component
  - `components/` - UI components (if any)
  - `screens/` - Screen components
  - `services/` - Business logic and API services
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions (if any)
  - `types/` - TypeScript type definitions
  - `constants/` - App constants
  - `navigation/` - Navigation setup (if any)

## Native Directories (Generated After Running)

These will be generated when you run `npm install` and platform-specific setup commands:

### iOS (Generated)
- `ios/` - iOS native project
  - Created when you run: `npx react-native init` or when you set up the iOS project
  - You'll need to set this up separately if starting fresh

### Android (Generated)
- `android/` - Android native project
  - Created when you run: `npx react-native init` or when you set up the Android project
  - You'll need to set this up separately if starting fresh

## Important Notes

### If Starting Fresh (No ios/android folders yet):

1. **Create React Native Project Structure:**
   ```bash
   npx react-native init TruckMatesELD --template react-native-template-typescript
   ```

2. **Copy all files from this project:**
   ```bash
   # Copy source files
   cp -r truckmates-eld-mobile/src/* TruckMatesELD/src/
   
   # Copy config files
   cp truckmates-eld-mobile/package.json TruckMatesELD/
   cp truckmates-eld-mobile/tsconfig.json TruckMatesELD/
   cp truckmates-eld-mobile/babel.config.js TruckMatesELD/
   cp truckmates-eld-mobile/index.js TruckMatesELD/
   cp truckmates-eld-mobile/app.json TruckMatesELD/
   ```

3. **Install dependencies:**
   ```bash
   cd TruckMatesELD
   npm install
   ```

### Environment Variables

**Never commit `.env` file!** Only copy `.env.example` and have users create their own `.env` file.

### Platform-Specific Setup

Before building for production:

**iOS:**
- Update `ios/TruckMatesELD/Info.plist`
- Configure signing in Xcode
- See `DEPLOYMENT.md` for details

**Android:**
- Update `android/app/build.gradle`
- Configure signing keys
- See `DEPLOYMENT.md` for details

## File Structure Overview

```
truckmates-eld-mobile/
├── src/                    # ✅ Copy this
│   ├── App.tsx            # ✅ Main app
│   ├── screens/           # ✅ All screens
│   ├── services/          # ✅ API & business logic
│   ├── hooks/             # ✅ Custom hooks
│   ├── types/             # ✅ TypeScript types
│   └── constants/         # ✅ App constants
├── package.json           # ✅ Dependencies
├── tsconfig.json          # ✅ TypeScript config
├── babel.config.js        # ✅ Babel config
├── index.js               # ✅ Entry point
├── app.json               # ✅ App metadata
├── .gitignore             # ✅ Git ignore
├── .env.example           # ✅ Env template
├── README.md              # ✅ Documentation
├── SETUP.md               # ✅ Setup guide
├── DEPLOYMENT.md          # ✅ Deployment guide
├── QUICK_START.md         # ✅ Quick start
├── ios/                   # ⚠️ Generated (setup separately)
└── android/               # ⚠️ Generated (setup separately)
```

## Copy Checklist

When copying files to a new location or repository:

- [ ] All files from `src/` directory
- [ ] `package.json`
- [ ] `tsconfig.json`
- [ ] `babel.config.js`
- [ ] `index.js`
- [ ] `app.json`
- [ ] `.gitignore`
- [ ] `.env.example` (NOT `.env`)
- [ ] All documentation files (`.md` files)
- [ ] Create `ios/` and `android/` directories (or use React Native CLI to generate)

## After Copying

1. Run `npm install`
2. Create `.env` from `.env.example`
3. Configure API endpoints and Supabase credentials
4. Run `npm run ios` or `npm run android` to test
5. Follow `DEPLOYMENT.md` for production builds

---

**Ready to deploy?** Follow the `DEPLOYMENT.md` guide for step-by-step instructions for App Store and Play Store submission.

