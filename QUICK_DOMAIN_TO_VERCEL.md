# Quick Guide: Point Hostinger Domain to Vercel

## ✅ Perfect! This is the BEST approach!

You've deleted the old site. Now just point your domain to Vercel - no file uploads needed!

---

## Step 1: Deploy Your App to Vercel (If Not Already Done)

### Option A: If you already have GitHub repo:

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up/Login** (use GitHub)
3. **Click "Add New" → "Project"**
4. **Import your GitHub repository**
5. **Add environment variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (optional)
6. **Click "Deploy"**
7. **Wait 2-3 minutes** - Your app will be live at `https://your-app.vercel.app`

### Option B: If you don't have GitHub repo yet:

1. **Push your code to GitHub:**
   ```bash
   cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   # Create repo on GitHub first, then:
   git remote add origin https://github.com/YOUR_USERNAME/your-repo.git
   git push -u origin main
   ```

2. **Then follow Option A above**

---

## Step 2: Add Your Domain in Vercel

1. **In Vercel dashboard**, go to your project
2. **Click "Settings"** → **"Domains"**
3. **Click "Add Domain"**
4. **Enter:** `truckmateslogistic.com`
5. **Click "Add"**
6. **Vercel will show you DNS records** - Keep this page open!

**You'll see something like:**
- **A Record** pointing to an IP address, OR
- **CNAME Record** pointing to `cname.vercel-dns.com`

---

## Step 3: Update DNS in Hostinger

1. **Log in to Hostinger:**
   - Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)

2. **Go to DNS Settings:**
   - Click **"Domains"** in left sidebar
   - Click on **"truckmateslogistic.com"**
   - Click **"DNS / Name Servers"** or **"DNS Zone Editor"** or **"Advanced DNS"**

3. **Remove old A records** (if any pointing to Hostinger IP)

4. **Add Vercel DNS record:**

   **If Vercel shows A Record:**
   - Type: `A`
   - Name: `@` (or leave blank for root domain)
   - Value: (IP address from Vercel)
   - TTL: `3600`

   **If Vercel shows CNAME (Recommended):**
   - Type: `CNAME`
   - Name: `@` (or leave blank for root domain)
   - Value: `cname.vercel-dns.com` (or what Vercel shows)
   - TTL: `3600`

5. **For www subdomain (optional):**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com` (or what Vercel shows)
   - TTL: `3600`

6. **Save all records**

---

## Step 4: Add Email DNS Records (For Resend)

**Keep your website DNS records AND add email records:**

1. **In same DNS Zone Editor**, add these records:

   **DKIM:**
   - Type: `TXT`
   - Name: `resend._domainkey`
   - Value: (from Resend - copy from Resend dashboard)
   - TTL: `3600`

   **SPF - MX:**
   - Type: `MX`
   - Name: `send`
   - Value: `feedback-smtp.us-east-1.amazonses.com` (or from Resend)
   - Priority: `10`
   - TTL: `3600`

   **SPF - TXT:**
   - Type: `TXT`
   - Name: `send`
   - Value: `v=spf1 include:amazonses.com ~all` (or from Resend)
   - TTL: `3600`

   **DMARC (Optional):**
   - Type: `TXT`
   - Name: `_dmarc`
   - Value: (from Resend)
   - TTL: `3600`

2. **Save all records**

---

## Step 5: Wait for DNS Propagation

⏰ **Wait 10-60 minutes** for DNS changes to take effect

### Verify:

1. **Check Vercel:**
   - Go to Vercel → Your Project → Domains
   - Status should show **"Valid Configuration"** ✅

2. **Check Resend:**
   - Go to Resend → Domains
   - Status should show **"Verified"** ✅

3. **Test your website:**
   - Visit `https://truckmateslogistic.com`
   - Should load your app from Vercel! 🎉

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

## Benefits of This Setup

✅ **No file uploads needed** - Everything runs on Vercel  
✅ **Automatic deployments** - Push to GitHub → Auto-deploys  
✅ **Free hosting** - Vercel free tier is generous  
✅ **Fast & reliable** - Global CDN, automatic SSL  
✅ **Easy updates** - Just push code to GitHub  
✅ **Domain stays in Hostinger** - You still own it there  

---

## Troubleshooting

### Domain Not Working?

1. **Wait longer** - DNS can take up to 48 hours (usually 10-60 min)
2. **Check DNS propagation:**
   - Use [whatsmydns.net](https://www.whatsmydns.net)
   - Enter your domain and check if records are updated
3. **Check Vercel domain status:**
   - Vercel → Project → Domains
   - Look for any error messages

### Still Having Issues?

- **Contact Vercel support** - They're very helpful
- **Check Hostinger DNS** - Make sure records are saved correctly

---

## Quick Checklist

- [ ] Deploy app to Vercel
- [ ] Add domain `truckmateslogistic.com` in Vercel
- [ ] Copy DNS records from Vercel
- [ ] Update DNS in Hostinger (point to Vercel)
- [ ] Add email DNS records (for Resend)
- [ ] Wait 10-60 minutes
- [ ] Test website at `https://truckmateslogistic.com`
- [ ] Test email notifications

---

**That's it!** Your domain will point to Vercel, and your app will be live! 🚀

