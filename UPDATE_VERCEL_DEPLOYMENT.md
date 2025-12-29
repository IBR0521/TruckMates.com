# Update Vercel Deployment - Troubleshooting Guide

## Issue: Not Seeing New Version on Vercel

Here are the steps to update your Vercel deployment:

---

## Option 1: Deploy via Vercel Dashboard (Easiest)

### If you deployed via GitHub:

1. **Push your changes to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Update platform with latest features"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Vercel will auto-deploy:**
   - If Vercel is connected to your GitHub repo, it will automatically deploy when you push
   - Go to Vercel Dashboard → Your Project → Deployments
   - You should see a new deployment starting

3. **If auto-deploy doesn't work:**
   - Go to Vercel Dashboard → Your Project → Settings → Git
   - Make sure it's connected to the correct repository
   - Click "Redeploy" on the latest deployment

---

## Option 2: Deploy via Vercel CLI (Recommended)

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Link to Existing Project (if already deployed)
```bash
vercel link
```
- It will ask for your project name
- Select your existing TruckMates project

### Step 4: Deploy
```bash
vercel --prod
```

This will:
- Build your project
- Upload to Vercel
- Deploy to production
- Show you the deployment URL

---

## Option 3: Manual Deploy from Vercel Dashboard

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Upload and Deploy:**
   - Go to **Deployments** tab
   - Click **"..."** (three dots) on any deployment
   - Click **"Redeploy"**
   - Or click **"Create Deployment"** → **"Upload"**
   - Drag and drop your project folder (or zip it first)

---

## Option 4: Force Redeploy (If Changes Not Showing)

### Via Dashboard:
1. Go to Vercel Dashboard → Your Project
2. Go to **Deployments** tab
3. Find the latest deployment
4. Click **"..."** → **"Redeploy"**
5. Check **"Use existing Build Cache"** → Uncheck it
6. Click **"Redeploy"**

### Via CLI:
```bash
vercel --prod --force
```

---

## Check Deployment Status

### View Logs:
1. Go to Vercel Dashboard → Your Project
2. Click on a deployment
3. Check **"Build Logs"** for any errors

### Common Issues:

**Build Failing?**
- Check build logs for errors
- Make sure all environment variables are set
- Verify `package.json` has all dependencies

**Changes Not Showing?**
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check if deployment completed successfully
- Verify you're looking at the production URL, not preview

**Environment Variables Missing?**
- Go to Settings → Environment Variables
- Add/update variables
- Redeploy after adding variables

---

## Quick Commands Summary

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link to existing project
vercel link

# Deploy to production
vercel --prod

# Force redeploy (ignores cache)
vercel --prod --force

# View deployments
vercel ls
```

---

## Still Not Working?

1. **Check Vercel Dashboard:**
   - Is the deployment showing as "Ready"?
   - Are there any build errors?
   - Is the correct branch selected?

2. **Verify Environment Variables:**
   - Settings → Environment Variables
   - Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

3. **Check Build Logs:**
   - Open the deployment
   - Check "Build Logs" for errors
   - Look for missing dependencies or TypeScript errors

4. **Clear Cache:**
   - In Vercel Dashboard → Settings → General
   - Click "Clear Build Cache"
   - Redeploy

---

## Need Help?

If you're still having issues, share:
- Screenshot of Vercel deployment page
- Build logs (if any errors)
- Your deployment URL

