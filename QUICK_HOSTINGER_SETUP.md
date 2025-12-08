# Quick Hostinger Setup Guide

## TL;DR - Fastest Way to Deploy

### Option 1: VPS Hosting (Recommended)

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2
sudo npm install -g pm2

# 4. Upload your project (via Git or FTP)
cd /var/www
git clone YOUR_REPO_URL logistics-saas
cd logistics-saas

# 5. Install dependencies
npm install

# 6. Create .env.local with your Supabase credentials
nano .env.local
# Add: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 7. Build
npm run build

# 8. Start with PM2
pm2 start npm --name "logistics-saas" -- start
pm2 save
pm2 startup

# 9. Setup Nginx (reverse proxy)
sudo apt install nginx -y
# Create config file (see full guide)
sudo systemctl restart nginx

# 10. Setup SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

### Option 2: Cloud Hosting with Node.js

1. **Upload files** via File Manager or Git
2. **Create Node.js app** in hPanel → Node.js
3. **Set startup file** to `server.js`
4. **Add environment variables** in Node.js settings
5. **Build and start** via terminal or hosting panel

### Option 3: Deploy to Vercel (Easiest - Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import GitHub repo
4. Add environment variables
5. Deploy (automatic)
6. Point Hostinger domain to Vercel via DNS

## Environment Variables Needed

```env
NEXT_PUBLIC_SUPABASE_URL=https://arzecjrilongtnlzmaty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyemVjanJpbG9uZ3RubHptYXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjc1MTUsImV4cCI6MjA4MDc0MzUxNX0.harBa_RmeVKk0er9KYeyGXgbfCBxxqCgqtIqq0bshLQ
NODE_ENV=production
```

## Important Notes

⚠️ **Next.js requires Node.js** - Make sure your Hostinger plan supports it!

✅ **Supabase is cloud-based** - No database setup needed on Hostinger

📝 **Full guide**: See `HOSTINGER_DEPLOYMENT_GUIDE.md` for detailed instructions

## Troubleshooting

- **502 Error**: Check if app is running (`pm2 list`)
- **Build fails**: Check Node.js version (needs 18+)
- **Env vars not working**: Restart app after adding them

