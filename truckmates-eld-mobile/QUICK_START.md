# Quick Start Guide

Get the TruckMates ELD mobile app running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd truckmates-eld-mobile
npm install
```

For iOS:
```bash
cd ios && pod install && cd ..
```

## Step 2: Configure Environment

Create `.env` file:
```env
API_BASE_URL=https://your-truckmates-platform.com/api
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Step 3: Run the App

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

That's it! 🎉

---

## What's Next?

1. **Test Login:** Use your TruckMates account credentials
2. **Register Device:** Complete device registration in the app
3. **Test Features:** Try location tracking and HOS logging

---

## Need Help?

- See `SETUP.md` for detailed setup instructions
- See `DEPLOYMENT.md` for production deployment
- Check `README.md` for project overview

