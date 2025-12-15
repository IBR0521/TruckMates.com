# Create New Deployment - Step by Step

## Method 1: Via Vercel Dashboard (Recommended)

### Step 1: Go to Vercel Dashboard
**Link:** https://vercel.com/dashboard

### Step 2: Select Your Project
- Click on your project (likely named "truck-mates-com" or similar)

### Step 3: Create New Deployment
**Option A: If "Create Deployment" button is visible**
1. Go to **"Deployments"** tab
2. Click **"Create Deployment"** button (usually top right)
3. Select:
   - **Branch**: `main`
   - **Commit**: Latest (`8a1f3c6` - "chore: Force deployment with version bump")
   - Click **"Deploy"**

**Option B: Refresh Git Connection (Most Reliable)**
1. Go to **Settings** → **Git**
2. Click **"Disconnect"** button
3. Click **"Connect Git Repository"**
4. Select: `IBR0521/TruckMates.com`
5. Select branch: `main`
6. This will automatically trigger a new deployment from the latest commit

### Step 4: Wait for Deployment
- Build will take 1-2 minutes
- You'll see progress in real-time
- When it says "Ready", your new deployment is live!

### Step 5: Verify
- Check that the deployment shows commit `8a1f3c6`
- Visit your site and check for "Try Demo for Free" button

---

## Method 2: Trigger via New Commit (I can do this for you)

I can make a tiny change and push it, which will trigger Vercel to auto-deploy the latest code.

**Just say "trigger deployment" and I'll do it!**

---

## Quick Links:
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Your GitHub Repo**: https://github.com/IBR0521/TruckMates.com
- **Latest Commit**: `8a1f3c6`

---

**Recommended:** Use Method 1, Option B (Refresh Git Connection) - it's the most reliable way to ensure Vercel deploys the latest code.
