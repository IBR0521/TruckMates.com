# Replacing Old Site with New Next.js App on Hostinger

## Current Situation
- ✅ Active Hostinger hosting with WordPress/old SaaS
- ✅ Domain: `truckmateslogistic.com`
- ✅ Want to deploy new Next.js app

## Step-by-Step Guide

### Step 1: Check Your Hosting Plan Type

1. In Hostinger dashboard, check what type of hosting you have:
   - **Shared Hosting** → May not support Node.js (need to check)
   - **Cloud Hosting** → Should support Node.js
   - **VPS Hosting** → Full control, can install Node.js

**How to check:**
- Look at your hosting plan name in Hostinger
- Or check if you see "Node.js" option in hPanel

### Step 2: Backup Old Site (Important!)

**Before deleting anything, backup your old site:**

1. In Hostinger dashboard → **"Files"** → **"Backups"**
2. Create a manual backup
3. Or download files via File Manager

**To backup:**
- Go to **"File Manager"** in hPanel
- Navigate to `public_html` folder
- Download all files (or use backup feature)

### Step 3: Clear Old Site Files

**Option A: Via File Manager (Easiest)**
1. Go to **"File Manager"** in hPanel
2. Navigate to `public_html` folder
3. Select all files and folders
4. Delete them (or move to a backup folder)

**Option B: Via FTP**
- Use FileZilla or similar
- Connect to your Hostinger FTP
- Delete files in `public_html` folder

### Step 4: Deploy New Next.js App

#### If You Have VPS or Cloud Hosting with Node.js:

**A. Install Node.js (if not already installed):**

1. In hPanel, go to **"Advanced"** → **"Node.js"**
2. If Node.js section exists, you can create a Node.js app
3. If not, you may need SSH access

**B. Upload Your Next.js App:**

**Via Git (Recommended):**
1. In hPanel → **"Node.js"** section
2. Click **"Create Application"**
3. Set:
   - **Node.js Version**: 20.x
   - **Application Root**: `public_html` (or create new folder)
   - **Application URL**: `truckmateslogistic.com`
   - **Application Startup File**: `server.js`

4. In Terminal/SSH:
   ```bash
   cd public_html
   git clone https://github.com/YOUR_USERNAME/your-repo.git .
   npm install
   npm run build
   ```

**Via File Manager:**
1. Upload all your project files to `public_html`
2. Make sure to include `.env.local` (or create it)

**C. Create server.js:**

Create `server.js` in your project root:
```javascript
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
```

**D. Set Environment Variables:**

In hPanel → **"Node.js"** → Your App → **"Environment Variables"**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `NODE_ENV=production`

**E. Start the Application:**

In hPanel → **"Node.js"** → Your App → **"Start Application"**

---

#### If You Have Shared Hosting (May Not Work):

⚠️ **Shared hosting usually doesn't support Node.js**

**Options:**
1. **Upgrade to VPS or Cloud Hosting** (recommended)
2. **Use Vercel instead** (easier, free)
3. **Contact Hostinger support** to check if your plan supports Node.js

---

### Step 5: Alternative - Deploy to Vercel (Easier)

If Hostinger hosting doesn't support Node.js, use Vercel:

1. **Deploy to Vercel:**
   - Push code to GitHub
   - Deploy on Vercel (free)
   - Get Vercel URL

2. **Point Domain to Vercel:**
   - In Vercel: Add domain `truckmateslogistic.com`
   - In Hostinger: Update DNS records
   - Change A record or CNAME to point to Vercel

3. **Old site will be replaced** when DNS propagates

---

## Recommended Approach

### ✅ Best Option: Use Vercel for Hosting

**Why:**
- ✅ FREE and optimized for Next.js
- ✅ No server management
- ✅ Automatic SSL
- ✅ Easy deployments
- ✅ Works with any Hostinger plan

**Steps:**
1. Deploy app to Vercel
2. In Vercel: Add domain `truckmateslogistic.com`
3. In Hostinger: Update DNS to point to Vercel
4. Old site will be replaced automatically

**This way:**
- You keep your domain in Hostinger
- App runs on Vercel (better performance)
- No need to manage servers
- Old site is replaced when DNS updates

---

## What Happens to Old Site?

- **If using Vercel:** Old site disappears when DNS points to Vercel
- **If using Hostinger hosting:** You manually delete old files and upload new app

---

## Next Steps

1. **Decide:** Vercel (easier) or Hostinger hosting (more complex)
2. **Backup old site** (if you want to keep it)
3. **Deploy new app** (Vercel or Hostinger)
4. **Update DNS** (if using Vercel)
5. **Add email DNS records** (for Resend)

Which option do you want to use?

