# How to Install CocoaPods

The build errors you're seeing are because CocoaPods (iOS dependency manager) is not installed. Here's how to fix it:

## Quick Installation

### Option 1: Install via Terminal (Recommended)

1. **Open Terminal** (Applications → Utilities → Terminal)

2. **Install CocoaPods:**
   ```bash
   sudo gem install cocoapods
   ```
   
3. **Enter your Mac password** when prompted

4. **Wait for installation to complete** (may take a few minutes)

5. **Verify installation:**
   ```bash
   pod --version
   ```
   Should show a version number like `1.14.0`

6. **Install pods for the project:**
   ```bash
   cd truckmates-eld-mobile/ios
   pod install
   ```

### Option 2: Install via Homebrew

If you have Homebrew installed:

```bash
brew install cocoapods
```

Then run:
```bash
cd truckmates-eld-mobile/ios
pod install
```

---

## After Installing CocoaPods

1. **Close Xcode** if it's open

2. **Open the `.xcworkspace` file** (NOT `.xcodeproj`):
   ```bash
   cd truckmates-eld-mobile/ios
   open TruckMatesELD.xcworkspace
   ```

3. **Build the project** in Xcode (Cmd+B or click Play ▶️)

---

## Troubleshooting

### "pod: command not found" after installation

Add CocoaPods to your PATH. Add this to your `~/.zshrc` file:

```bash
export PATH="$HOME/.gem/bin:$PATH"
```

Then reload:
```bash
source ~/.zshrc
```

### "Permission denied" error

Use `sudo`:
```bash
sudo gem install cocoapods
```

### Installation takes too long

This is normal - CocoaPods downloads dependencies. Be patient.

---

**Once CocoaPods is installed and `pod install` completes, your build errors should be resolved!**

