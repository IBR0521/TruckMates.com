# Deployment Guide for TruckMates ELD Mobile App

This guide covers deploying the mobile app to both Apple App Store and Google Play Store.

## Prerequisites

### iOS (Apple App Store)
- Apple Developer Account ($99/year)
- Mac computer with Xcode installed
- Valid provisioning profiles and certificates
- App Store Connect access

### Android (Google Play Store)
- Google Play Developer Account ($25 one-time)
- Android Studio installed
- Signed APK/AAB file
- Google Play Console access

---

## iOS Deployment (App Store)

### 1. Configure App Settings

Update `ios/TruckMatesELD/Info.plist`:
```xml
<key>CFBundleDisplayName</key>
<string>TruckMates ELD</string>
<key>CFBundleVersion</key>
<string>1</string>
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
```

### 2. Update Bundle Identifier

In Xcode:
1. Open `ios/TruckMatesELD.xcworkspace`
2. Select project → General tab
3. Update Bundle Identifier: `com.yourcompany.truckmateseld`
4. Update Team (your Apple Developer team)

### 3. Configure Capabilities

In Xcode → Signing & Capabilities:
- ✅ Background Modes → Location updates
- ✅ Location Services
- ✅ Background fetch
- ✅ Remote notifications (optional)

### 4. Set Version and Build Number

Update `ios/TruckMatesELD/Info.plist`:
- Version: 1.0.0
- Build: 1

### 5. Archive Build

1. In Xcode, select "Any iOS Device" as target
2. Product → Archive
3. Wait for archive to complete
4. Organizer window opens automatically

### 6. Upload to App Store Connect

1. In Organizer, select your archive
2. Click "Distribute App"
3. Choose "App Store Connect"
4. Follow prompts to upload
5. Wait for processing (can take 15-30 minutes)

### 7. Submit for Review

1. Go to App Store Connect (appstoreconnect.apple.com)
2. Select your app
3. Click "+ Version or Platform"
4. Fill in app information:
   - Name: TruckMates ELD
   - Subtitle: Electronic Logging Device
   - Description: (your app description)
   - Keywords: ELD, HOS, trucking, logging, compliance
   - Screenshots: Required (6.5", 5.5", iPad Pro)
   - App Icon: 1024x1024px
   - Privacy Policy URL: (required)
5. Submit for review

### 8. App Store Listing

Required Information:
- **Category**: Productivity / Business
- **Age Rating**: 4+ (recommended)
- **Privacy Policy URL**: (required for location tracking)
- **Support URL**: Your support page
- **Marketing URL**: (optional)

---

## Android Deployment (Google Play Store)

### 1. Generate Signing Key

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore truckmates-eld-key.keystore -alias truckmates-eld -keyalg RSA -keysize 2048 -validity 10000
```

Save the keystore file securely and remember the password!

### 2. Configure Gradle Signing

Create `android/keystore.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=truckmates-eld-key.keystore
MYAPP_RELEASE_KEY_ALIAS=truckmates-eld
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
```

Update `android/app/build.gradle`:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['MYAPP_RELEASE_STORE_FILE'])
                storePassword keystoreProperties['MYAPP_RELEASE_STORE_PASSWORD']
                keyAlias keystoreProperties['MYAPP_RELEASE_KEY_ALIAS']
                keyPassword keystoreProperties['MYAPP_RELEASE_KEY_PASSWORD']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

### 3. Update App Version

In `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        versionCode 1
        versionName "1.0.0"
        ...
    }
}
```

### 4. Update App Name and Icon

- **App Name**: `android/app/src/main/res/values/strings.xml`
  ```xml
  <string name="app_name">TruckMates ELD</string>
  ```

- **App Icon**: Replace `android/app/src/main/res/mipmap-*/ic_launcher.png` files
  - Create 1024x1024px icon
  - Generate all sizes using Android Asset Studio

### 5. Build Release APK/AAB

**For APK (testing only):**
```bash
cd android
./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

**For AAB (required for Play Store):**
```bash
cd android
./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 6. Create App in Play Console

1. Go to Google Play Console (play.google.com/console)
2. Create new app
3. Fill in app details:
   - App name: TruckMates ELD
   - Default language: English
   - App or game: App
   - Free or paid: Choose based on your business model

### 7. Create App Bundle Upload

1. Go to Production → Create new release
2. Upload the AAB file
3. Add release notes
4. Save (don't publish yet)

### 8. Complete Store Listing

**Required Information:**
- **App name**: TruckMates ELD
- **Short description**: (80 characters max)
- **Full description**: Detailed app description
- **Screenshots**: 
  - Phone: At least 2 (up to 8)
  - Tablet: Optional
  - Minimum size: 320px
  - Maximum size: 3840px
- **App icon**: 512x512px
- **Feature graphic**: 1024x500px
- **Privacy Policy**: URL (required for location tracking)

### 9. Content Rating

1. Complete content rating questionnaire
2. Answer questions about app content
3. Submit for rating (usually instant)

### 10. Target Audience & Content

- Target audience: 18+ (trucking professionals)
- Category: Productivity / Business
- Tags: ELD, HOS, trucking, logging

### 11. Data Safety

Complete Data Safety section:
- **Data collected**: 
  - Location data (continuous)
  - Device identifiers
  - User accounts
- **Data sharing**: Specify if data is shared
- **Security practices**: Describe encryption, etc.

### 12. Submit for Review

1. Review all sections (green checkmarks)
2. Click "Submit for review"
3. Wait for review (usually 1-7 days)

---

## Post-Deployment

### Update Process

**iOS:**
1. Update version in Info.plist
2. Archive new build
3. Upload to App Store Connect
4. Submit new version for review

**Android:**
1. Update `versionCode` and `versionName` in build.gradle
2. Build new AAB
3. Upload to Play Console
4. Submit for review

### App Updates

For updates:
- **iOS**: Increment CFBundleVersion
- **Android**: Increment versionCode

---

## Important Notes

### Privacy Policy Required
Both stores require a privacy policy URL because the app collects location data. Make sure you have one hosted publicly.

### Permissions
The app requires:
- **Location** (always/allowed) - Required for ELD functionality
- **Background location** - Required for continuous tracking

### Testing
Before submitting:
1. Test on real devices (not just emulator)
2. Test location tracking in background
3. Test offline functionality
4. Test all HOS features
5. Verify API connectivity

### Support
Provide support contact information in store listings.

---

## Troubleshooting

### iOS Build Issues
- Clean build folder: Cmd+Shift+K in Xcode
- Delete derived data
- Reinstall pods: `cd ios && pod install`

### Android Build Issues
- Clean: `cd android && ./gradlew clean`
- Check keystore path and passwords
- Verify signing config in build.gradle

### Upload Failures
- Check bundle/package identifier matches
- Verify signing certificates are valid
- Ensure all required metadata is filled

---

## File Checklist

Before submitting, ensure you have:
- [ ] App icon (1024x1024 for iOS, 512x512 for Android)
- [ ] Screenshots (various sizes)
- [ ] Privacy Policy URL
- [ ] App description
- [ ] Support URL
- [ ] Marketing materials (optional)

Good luck with your app launch! 🚀

