# Step-by-Step: Deploy Your SaaS App to Vercel

Follow these steps in order. I'll guide you through each one.

---

## Step 1: Create GitHub Account (If You Don't Have One)

1. Go to [github.com](https://github.com)
2. Click "Sign up"
3. Create your account
4. Verify your email

**Come back here when done!**

---

## Step 2: Create a New Repository on GitHub

1. After logging into GitHub, click the **"+"** icon in the top right
2. Click **"New repository"**
3. Fill in:
   - **Repository name**: `truckmates-saas` (or any name you like)
   - **Description**: (optional) "Logistics SaaS Application"
   - **Visibility**: Choose **Public** (free) or **Private** (if you want)
   - **DO NOT** check "Add a README file"
   - **DO NOT** add .gitignore or license
4. Click **"Create repository"**

**You'll see a page with instructions. DON'T follow those yet - we'll do it from your computer!**

---

## Step 3: Push Your Code to GitHub

I'll help you run these commands. Just follow along:

### 3.1: Initialize Git (if not already done)
```bash
git init
```

### 3.2: Add All Files
```bash
git add .
```

### 3.3: Make First Commit
```bash
git commit -m "Initial commit - Logistics SaaS App"
```

### 3.4: Connect to GitHub
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/truckmates-saas.git
```
*(Replace YOUR_USERNAME with your actual GitHub username)*

### 3.5: Push to GitHub
```bash
git push -u origin main
```

**You'll be asked for your GitHub username and password.**
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your regular password)

**To create a Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it: "Vercel Deployment"
4. Select scopes: Check **"repo"** (this gives full access to repositories)
5. Click "Generate token"
6. **COPY THE TOKEN** (you won't see it again!)
7. Use this token as your password when pushing

---

## Step 4: Deploy to Vercel

### 4.1: Go to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub account

### 4.2: Import Your Project

1. After logging in, you'll see the Vercel dashboard
2. Click **"Add New..."** → **"Project"**
3. You'll see a list of your GitHub repositories
4. Find **"truckmates-saas"** (or whatever you named it)
5. Click **"Import"** next to it

### 4.3: Configure Project

1. **Project Name**: Leave as is (or change if you want)
2. **Framework Preset**: Should auto-detect "Next.js" ✅
3. **Root Directory**: Leave as `./` ✅
4. **Build Command**: Leave as `npm run build` ✅
5. **Output Directory**: Leave as `.next` ✅
6. **Install Command**: Leave as `npm install` ✅

**DON'T click Deploy yet!** We need to add environment variables first.

### 4.4: Add Environment Variables

1. Before clicking "Deploy", click **"Environment Variables"** section
2. Click **"Add Another"** to add each variable:

   **Variable 1:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://arzecjrilongtnlzmaty.supabase.co`
   - **Environments**: Check all three ✅
     - ✅ Production
     - ✅ Preview  
     - ✅ Development

   **Variable 2:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyemVjanJpbG9uZ3RubHptYXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjc1MTUsImV4cCI6MjA4MDc0MzUxNX0.harBa_RmeVKk0er9KYeyGXgbfCBxxqCgqtIqq0bshLQ`
   - **Environments**: Check all three ✅
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. Make sure both variables are added!

### 4.5: Deploy!

1. Click the big **"Deploy"** button
2. Wait 2-3 minutes while Vercel:
   - Installs dependencies
   - Builds your app
   - Deploys it
3. You'll see a progress bar
4. When it says **"Ready"** ✅, click on your project

### 4.6: Your App is Live! 🎉

You'll see a URL like: `https://truckmates-saas.vercel.app`

**Click on it to see your live app!**

---

## Step 5: Update Supabase Settings

Your app needs to know about the Vercel URL:

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add to **Site URL**: `https://your-app-name.vercel.app`
5. Add to **Redirect URLs**: 
   - `https://your-app-name.vercel.app/**`
   - `https://your-app-name.vercel.app/auth/callback`
6. Click **Save**

---

## Step 6: Test Your App

1. Visit your Vercel URL
2. Try to:
   - Register a new account
   - Login
   - Create a driver
   - Create a truck
   - Test all features

If everything works, you're done! 🎉

---

## Step 7: Connect Your .com Domain (Optional)

If you want to use your Hostinger domain:

1. In Vercel, go to your project → **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter your domain: `yourdomain.com`
4. Click **"Add"**
5. Vercel will show you DNS settings
6. Go to Hostinger → DNS settings
7. Add the DNS records Vercel provided
8. Wait 10-30 minutes
9. Done! Your app is now at `https://yourdomain.com`

---

## Troubleshooting

### Build Fails?
- Check the build logs in Vercel
- Make sure all environment variables are set
- Check that your code doesn't have errors

### App Works But Can't Login?
- Make sure you updated Supabase URL settings (Step 5)
- Check that environment variables are correct

### Need to Update Your App?
- Just make changes to your code
- Push to GitHub: `git add . && git commit -m "Update" && git push`
- Vercel automatically deploys the update!

---

## What Happens Next?

✅ **Every time you push code to GitHub, Vercel automatically deploys it!**

✅ **Your app is live 24/7**

✅ **Free SSL certificate included**

✅ **Fast loading worldwide**

---

## Need Help?

If you get stuck at any step, let me know which step and I'll help you!

