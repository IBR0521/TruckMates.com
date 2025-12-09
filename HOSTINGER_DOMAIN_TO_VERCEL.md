# Using Hostinger Domain with Vercel Hosting (Recommended)

## ✅ Best Setup for Your Situation

**Domain:** Hostinger (`truckmateslogistics.com`)  
**Hosting:** Vercel (FREE, optimized for Next.js)  
**Email:** Resend (add DNS records in Hostinger)

This is the **easiest and best** setup because:
- ✅ Vercel is FREE and perfect for Next.js
- ✅ No server management needed
- ✅ Automatic SSL certificates
- ✅ Fast global CDN
- ✅ Easy deployments from GitHub
- ✅ You still own your domain in Hostinger

---

## Step 1: Deploy Your App to Vercel (If Not Already Done)

### If you haven't deployed to Vercel yet:

1. **Push your code to GitHub:**
   ```bash
   cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/truckmates-app.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "Add New" → "Project"
   - Select your repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `RESEND_API_KEY`
   - Click "Deploy"
   - Your app will be live at `https://your-app.vercel.app`

---

## Step 2: Connect Your Hostinger Domain to Vercel

### In Vercel:

1. Go to your project in Vercel
2. Click **"Settings"** → **"Domains"**
3. Click **"Add Domain"**
4. Enter: `truckmateslogistics.com`
5. Click **"Add"**
6. Vercel will show you DNS records to add

### In Hostinger:

1. Log in to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Go to **"Domains"** → **"truckmateslogistics.com"** → **"DNS Zone Editor"** (or "Advanced DNS")
3. **Remove or update existing A records** pointing to Hostinger IP
4. **Add these records from Vercel:**

   **Option A: Use A Records (if Vercel provides IP addresses)**
   - Type: `A`
   - Name: `@` (or leave blank for root domain)
   - Value: (IP address from Vercel)
   - TTL: `3600`

   **Option B: Use CNAME (Recommended)**
   - Type: `CNAME`
   - Name: `@` (or `www`)
   - Value: `cname.vercel-dns.com` (or what Vercel shows)
   - TTL: `3600`

5. **For www subdomain (optional):**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com` (or what Vercel shows)

6. **Save all records**

---

## Step 3: Add Email DNS Records (For Resend)

**Keep your existing records** and **add these new ones** for email:

### In Hostinger DNS Zone Editor:

1. **DKIM Record:**
   - Type: `TXT`
   - Name: `resend._domainkey`
   - Value: (from Resend - starts with `p=MIGfMA0GCSqGSIb3DQEB...`)
   - TTL: `3600`

2. **SPF - MX Record:**
   - Type: `MX`
   - Name: `send`
   - Value: `feedback-smtp.us-east-1.amazonses.com` (or from Resend)
   - Priority: `10`
   - TTL: `3600`

3. **SPF - TXT Record:**
   - Type: `TXT`
   - Name: `send`
   - Value: `v=spf1 include:amazonses.com ~all` (or from Resend)
   - TTL: `3600`

4. **DMARC Record (Optional):**
   - Type: `TXT`
   - Name: `_dmarc`
   - Value: (from Resend)
   - TTL: `3600`

---

## Step 4: Wait for DNS Propagation

⏰ **Wait 10-60 minutes** for DNS changes to take effect

### Verify:

1. **Check domain in Vercel:**
   - Go to Vercel → Your Project → Domains
   - Status should show "Valid Configuration" ✅

2. **Check email in Resend:**
   - Go to Resend → Domains
   - Status should show "Verified" ✅

3. **Test your website:**
   - Visit `https://truckmateslogistics.com`
   - Should load your app from Vercel

---

## Final DNS Records Summary

Your Hostinger DNS should have:

**For Website (Vercel):**
- `@` → CNAME → `cname.vercel-dns.com` (or A record to Vercel IP)
- `www` → CNAME → `cname.vercel-dns.com` (optional)

**For Email (Resend):**
- `resend._domainkey` → TXT → (from Resend)
- `send` → MX → `feedback-smtp.us-east-1.amazonses.com`
- `send` → TXT → `v=spf1 include:amazonses.com ~all`
- `_dmarc` → TXT → (from Resend)

---

## Troubleshooting

### Domain Not Working?

1. **Check DNS propagation:**
   - Use [whatsmydns.net](https://www.whatsmydns.net)
   - Enter your domain and check if records are updated globally

2. **Wait longer:**
   - DNS can take up to 48 hours (usually 10-60 minutes)

3. **Check Vercel domain status:**
   - Vercel → Project → Domains
   - Look for any error messages

### Email Not Working?

1. **Check Resend domain status:**
   - Resend → Domains
   - Click "Verify" to check status

2. **Verify DNS records:**
   - Use [mxtoolbox.com/TXTLookup.aspx](https://mxtoolbox.com/TXTLookup.aspx)
   - Check if TXT records appear

---

## Benefits of This Setup

✅ **Best of both worlds:**
- Domain managed in Hostinger (where you bought it)
- App hosted on Vercel (free, fast, optimized)

✅ **No server management:**
- Vercel handles everything automatically
- Automatic SSL certificates
- Global CDN for fast loading

✅ **Easy updates:**
- Push to GitHub → Auto-deploys to Vercel
- No FTP or server access needed

✅ **Cost effective:**
- Vercel free tier is generous
- Only pay for domain (already have it)

---

## Next Steps

1. ✅ Deploy to Vercel (if not done)
2. ✅ Connect domain in Vercel
3. ✅ Add DNS records in Hostinger
4. ✅ Add email DNS records in Hostinger
5. ✅ Wait for propagation
6. ✅ Test everything!

Your app will be live at `https://truckmateslogistics.com` and emails will work perfectly! 🎉

