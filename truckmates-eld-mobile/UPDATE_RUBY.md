# How to Update Ruby on macOS

Your current Ruby version is 2.6.10, which is too old. Here's how to update it:

## Method 1: Install Homebrew + Ruby (Recommended)

### Step 1: Install Homebrew (if not installed)

Open Terminal and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the prompts and enter your password when asked.

### Step 2: Install Ruby via Homebrew

```bash
brew install ruby
```

### Step 3: Update PATH

Add this to your `~/.zshrc` file:
```bash
echo 'export PATH="/opt/homebrew/opt/ruby/bin:$PATH"' >> ~/.zshrc
echo 'export PATH="/opt/homebrew/lib/ruby/gems/3.3.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Step 4: Verify

```bash
ruby --version
```

Should show Ruby 3.x.x

---

## Method 2: Using rbenv (Ruby Version Manager)

### Step 1: Install rbenv via Homebrew

```bash
brew install rbenv ruby-build
```

### Step 2: Initialize rbenv

Add to `~/.zshrc`:
```bash
echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc
source ~/.zshrc
```

### Step 3: Install latest Ruby

```bash
rbenv install 3.3.0
rbenv global 3.3.0
```

### Step 4: Verify

```bash
ruby --version
```

---

## Method 3: Quick Fix (Use System Ruby with sudo)

If you just want to install CocoaPods quickly without updating Ruby:

```bash
sudo gem install cocoapods
```

This will work with your current Ruby version.

---

## After Updating Ruby

1. **Install CocoaPods:**
   ```bash
   gem install cocoapods
   # No sudo needed if using Homebrew Ruby
   ```

2. **Install iOS dependencies:**
   ```bash
   cd truckmates-eld-mobile/ios
   pod install
   ```

---

## Recommended Approach

**For development:** Use Method 1 (Homebrew) - it's the easiest and keeps Ruby updated.

**For quick fix:** Use Method 3 (sudo) - fastest if you just want CocoaPods working now.

