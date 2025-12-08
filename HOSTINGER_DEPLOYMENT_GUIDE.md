# Hostinger Deployment Guide for Next.js SaaS Application

This guide will walk you through deploying your Next.js logistics SaaS application to Hostinger hosting.

## Prerequisites

1. **Hostinger Account** with one of these hosting types:
   - **VPS Hosting** (Recommended for Next.js)
   - **Cloud Hosting** (with Node.js support)
   - **Shared Hosting** (if it supports Node.js - check with Hostinger support)

2. **Domain name** (if not already configured)

3. **Supabase account** (already set up - your database is cloud-based)

## Important Notes

⚠️ **Next.js requires Node.js runtime** - Make sure your Hostinger plan supports Node.js applications. If you're on shared hosting, you may need to upgrade to VPS or Cloud hosting.

## Step-by-Step Deployment

### Option 1: VPS Hosting (Recommended)

If you have VPS hosting, you have full control and can deploy Next.js easily.

#### 1. Connect to Your VPS via SSH

```bash
ssh root@your-server-ip
# or
ssh username@your-server-ip
```

#### 2. Install Node.js and npm

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### 3. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

#### 4. Upload Your Project Files

**Option A: Using Git (Recommended)**
```bash
# Install Git
sudo apt install git -y

# Clone your repository (if using Git)
cd /var/www
git clone https://github.com/yourusername/your-repo.git logistics-saas
cd logistics-saas
```

**Option B: Using FTP/SFTP**
- Use FileZilla or similar FTP client
- Upload all project files to `/var/www/logistics-saas` (or your preferred directory)
- Make sure to upload hidden files like `.env.local`

#### 5. Install Dependencies

```bash
cd /var/www/logistics-saas
npm install
# or if using pnpm
npm install -g pnpm
pnpm install
```

#### 6. Set Up Environment Variables

```bash
# Create .env.local file
nano .env.local
```

Add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://arzecjrilongtnlzmaty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyemVjanJpbG9uZ3RubHptYXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjc1MTUsImV4cCI6MjA4MDc0MzUxNX0.harBa_RmeVKk0er9KYeyGXgbfCBxxqCgqtIqq0bshLQ
```

Save and exit (Ctrl+X, then Y, then Enter)

#### 7. Build the Application

```bash
npm run build
```

#### 8. Start the Application with PM2

```bash
# Start Next.js in production mode
pm2 start npm --name "logistics-saas" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

#### 9. Configure Nginx (Reverse Proxy)

Install Nginx:
```bash
sudo apt install nginx -y
```

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/logistics-saas
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/logistics-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 10. Set Up SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Option 2: Cloud Hosting with Node.js Support

If you're using Hostinger Cloud Hosting with Node.js support:

#### 1. Access Hostinger hPanel

1. Log in to your Hostinger account
2. Go to **hPanel** → **Advanced** → **Node.js**

#### 2. Upload Your Project

**Via File Manager:**
1. Go to **File Manager** in hPanel
2. Navigate to `domains/yourdomain.com/public_html`
3. Upload all your project files (or use Git if available)

**Via Git:**
1. In Node.js section, you can clone your repository
2. Or use SSH to access and clone

#### 3. Configure Node.js App

1. In hPanel → **Node.js** section
2. Click **Create Application**
3. Set:
   - **Node.js Version**: 20.x (or latest LTS)
   - **Application Root**: `public_html` (or your project folder)
   - **Application URL**: `yourdomain.com`
   - **Application Startup File**: `server.js` (you'll need to create this)

#### 4. Create server.js

In your project root, create `server.js`:
```javascript
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
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

#### 5. Set Environment Variables

In hPanel → **Node.js** → Your App → **Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NODE_ENV=production`

#### 6. Install Dependencies and Build

In hPanel → **Node.js** → Your App → **Terminal**:
```bash
npm install
npm run build
```

#### 7. Start the Application

In hPanel → **Node.js** → Your App → **Start Application**

### Option 3: Shared Hosting (If Node.js Supported)

⚠️ **Note**: Most shared hosting plans don't support Next.js. Check with Hostinger support first.

If supported:
1. Upload files via FTP
2. Set environment variables in hosting control panel
3. Build and run via SSH or hosting panel

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] Application builds successfully
- [ ] Application is running on port 3000 (or configured port)
- [ ] Domain is pointing to your server
- [ ] SSL certificate is installed
- [ ] Supabase connection is working
- [ ] Test user registration/login
- [ ] Test creating drivers, trucks, loads, routes

## Troubleshooting

### Application won't start
- Check Node.js version: `node --version` (should be 18+)
- Check if port 3000 is available: `netstat -tulpn | grep 3000`
- Check PM2 logs: `pm2 logs logistics-saas`

### 502 Bad Gateway
- Check if Next.js is running: `pm2 list`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify proxy_pass points to correct port

### Environment variables not working
- Make sure `.env.local` is in project root
- Restart the application after changing env vars
- Check if variables are prefixed with `NEXT_PUBLIC_` for client-side access

### Build errors
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility

## Updating Your Application

When you make changes:

```bash
# SSH into your server
ssh user@your-server

# Navigate to project
cd /var/www/logistics-saas

# Pull latest changes (if using Git)
git pull

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Restart application
pm2 restart logistics-saas
```

## Alternative: Deploy to Vercel (Easier Option)

If Hostinger deployment is too complex, consider deploying to **Vercel** (free tier available):

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables
5. Deploy (automatic)

Then point your Hostinger domain to Vercel using DNS settings.

## Need Help?

- **Hostinger Support**: Check their documentation or contact support
- **Next.js Docs**: https://nextjs.org/docs/deployment
- **PM2 Docs**: https://pm2.keymetrics.io/docs/

---

**Important**: Make sure your Supabase project allows connections from your Hostinger server IP address if you have IP restrictions enabled.

