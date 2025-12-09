# How to Upload Next.js Files to Hostinger

## ⚠️ Important First: Check if Hostinger Supports Node.js

**Before uploading, you need to check:**

1. In Hostinger hPanel, look for **"Node.js"** section
2. Go to **"Advanced"** → Check if **"Node.js"** option exists
3. If NO Node.js option → You need VPS/Cloud hosting OR use Vercel instead

**Next.js requires Node.js to run!** You can't just upload files like a regular HTML website.

---

## Which Files to Upload

### ✅ Files to Upload:

**All project files EXCEPT these:**

1. **`node_modules/`** - ❌ DON'T upload (too large, will be installed on server)
2. **`.next/`** - ❌ DON'T upload (will be built on server)
3. **`.git/`** - ❌ DON'T upload (Git repository files)
4. **`.env.local`** - ⚠️ Upload but rename to `.env` (or create on server)
5. **`*.log`** - ❌ DON'T upload (log files)

### ✅ Upload These:

```
✅ app/                    (all files)
✅ components/             (all files)
✅ lib/                    (all files)
✅ public/                 (all files)
✅ styles/                 (all files)
✅ hooks/                  (all files)
✅ package.json            (IMPORTANT!)
✅ package-lock.json       (IMPORTANT!)
✅ tsconfig.json           (if using TypeScript)
✅ next.config.mjs         (IMPORTANT!)
✅ postcss.config.mjs      (if exists)
✅ tailwind.config.js      (if exists)
✅ .env.local              (rename to .env or create on server)
✅ server.js               (you'll create this)
✅ Any other config files
```

---

## Step-by-Step Upload Process

### Method 1: Using File Manager (Easiest)

#### Step 1: Prepare Files Locally

1. **Create a ZIP file of your project:**
   ```bash
   # On your Mac, create a folder with only the files to upload
   # Exclude: node_modules, .next, .git
   ```

2. **Or use this command to create a clean copy:**
   ```bash
   # Create a temporary folder
   mkdir upload-files
   
   # Copy all files except node_modules, .next, .git
   rsync -av --exclude 'node_modules' --exclude '.next' --exclude '.git' \
     --exclude '*.log' --exclude '.DS_Store' \
     . upload-files/
   
   # Create ZIP
   cd upload-files
   zip -r ../nextjs-app.zip .
   ```

#### Step 2: Upload to Hostinger

1. **Log in to Hostinger hPanel**
2. **Open File Manager**
3. **Navigate to `public_html` folder**
4. **Upload the ZIP file:**
   - Click **"Upload"** button
   - Select your ZIP file
   - Wait for upload to complete

5. **Extract the ZIP:**
   - Right-click on the ZIP file
   - Click **"Extract"** or **"Unzip"**
   - All files will be extracted to `public_html`

6. **Delete the ZIP file** (to save space)

---

### Method 2: Using FTP (Alternative)

1. **Get FTP credentials from Hostinger:**
   - hPanel → **"FTP Accounts"**
   - Note: FTP server, username, password

2. **Use FTP client (FileZilla, Cyberduck, etc.):**
   - Connect to your Hostinger FTP
   - Navigate to `/public_html` folder
   - Upload all files (except node_modules, .next, .git)

3. **Upload files:**
   - Drag and drop files from your computer
   - Wait for upload to complete

---

## Step 3: Create server.js File

You need to create a `server.js` file in your project root:

1. **In File Manager, go to `public_html`**
2. **Click "New File"**
3. **Name it:** `server.js`
4. **Add this content:**

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

5. **Save the file**

---

## Step 4: Set Up Environment Variables

1. **In File Manager, go to `public_html`**
2. **Create `.env` file** (or rename `.env.local` to `.env`)
3. **Add your environment variables:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
RESEND_API_KEY=re_your-api-key-here
RESEND_FROM_EMAIL=TruckMates <notifications@truckmateslogistic.com>
NODE_ENV=production
```

4. **Save the file**

---

## Step 5: Install Dependencies and Build

### Option A: Using Node.js Section in hPanel

1. **Go to hPanel → "Advanced" → "Node.js"**
2. **Create New Application:**
   - **Node.js Version:** 20.x (or latest LTS)
   - **Application Root:** `public_html`
   - **Application URL:** `truckmateslogistic.com`
   - **Application Startup File:** `server.js`
   - **Port:** `3000` (or what Hostinger assigns)

3. **In Terminal/SSH (if available):**
   ```bash
   cd public_html
   npm install
   npm run build
   ```

4. **Start the application:**
   - In Node.js section, click **"Start Application"**

### Option B: Using SSH (If Available)

1. **Get SSH access from Hostinger**
2. **Connect via Terminal:**
   ```bash
   ssh username@your-server-ip
   ```

3. **Navigate and install:**
   ```bash
   cd public_html
   npm install
   npm run build
   ```

4. **Start with PM2 (if installed):**
   ```bash
   pm2 start server.js --name truckmates
   pm2 save
   pm2 startup
   ```

---

## Step 6: Configure Domain

1. **In hPanel → "Domains" → "truckmateslogistic.com"**
2. **Make sure domain points to `public_html`**
3. **If using Node.js app, configure the URL in Node.js settings**

---

## Troubleshooting

### "Node.js not found" or "npm not found"

**Problem:** Hostinger shared hosting doesn't support Node.js

**Solution:**
- Upgrade to VPS or Cloud hosting with Node.js
- OR use Vercel instead (easier, free)

### Build fails

**Check:**
- All files uploaded correctly
- `package.json` is present
- Environment variables are set
- Node.js version is correct (20.x recommended)

### App not starting

**Check:**
- `server.js` file exists and is correct
- Port number is correct
- Environment variables are set
- Application is started in Node.js section

---

## ⚠️ Important Notes

1. **Node.js Required:** Next.js needs Node.js runtime. If Hostinger doesn't support it, use Vercel.

2. **Build Process:** You need to run `npm install` and `npm run build` on the server.

3. **Server Running:** The app needs to run continuously (use PM2 or Hostinger's Node.js manager).

4. **Easier Alternative:** Consider using Vercel - it's free, easier, and optimized for Next.js.

---

## Recommended: Use Vercel Instead

**If Hostinger doesn't support Node.js, use Vercel:**

1. **Deploy to Vercel** (free, 5 minutes)
2. **Point domain to Vercel** (update DNS in Hostinger)
3. **No file uploads needed**
4. **Automatic deployments**

**This is much easier!** 🚀

---

## Quick Checklist

- [ ] Check if Hostinger supports Node.js
- [ ] Prepare files (exclude node_modules, .next, .git)
- [ ] Upload files to `public_html`
- [ ] Create `server.js` file
- [ ] Create `.env` file with environment variables
- [ ] Install dependencies (`npm install`)
- [ ] Build the app (`npm run build`)
- [ ] Start the application
- [ ] Test your website

---

**Need help?** Let me know if you encounter any issues! 🛠️

