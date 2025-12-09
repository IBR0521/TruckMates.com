# Fix "Invalid Configuration" in Vercel

## Current Status
- ✅ Domains added to Vercel: `truckmateslogistic.com` and `www.truckmateslogistic.com`
- ❌ Status: "Invalid Configuration" (DNS not set up yet)

## Step-by-Step Fix

### Step 1: Get DNS Records from Vercel

1. **In Vercel**, click on **"Edit"** next to `www.truckmateslogistic.com`
2. **Vercel will show you DNS records** to add
3. **Copy these records** - You'll see something like:
   - **A Record** with an IP address, OR
   - **CNAME Record** pointing to `cname.vercel-dns.com`

**Note:** Vercel usually provides:
- **CNAME** for `www` subdomain
- **A Record** or **CNAME** for root domain (`@`)

### Step 2: Update DNS in Hostinger

1. **Log in to Hostinger:**
   - Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)

2. **Go to DNS Settings:**
   - Click **"Domains"** in left sidebar
   - Click on **"truckmateslogistic.com"**
   - Click **"DNS / Name Servers"** or **"DNS Zone Editor"** or **"Advanced DNS"**

3. **Remove old records** (if any pointing to Hostinger IP)

4. **Add Vercel DNS records:**

   **For root domain (`truckmateslogistic.com`):**
   
   **If Vercel shows A Record:**
   - Type: `A`
   - Name: `@` (or leave blank)
   - Value: (IP address from Vercel - usually something like `76.76.21.21`)
   - TTL: `3600`
   
   **If Vercel shows CNAME:**
   - Type: `CNAME`
   - Name: `@` (or leave blank)
   - Value: `cname.vercel-dns.com` (or what Vercel shows)
   - TTL: `3600`

   **For www subdomain (`www.truckmateslogistic.com`):**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com` (or what Vercel shows)
   - TTL: `3600`

5. **Save all records**

### Step 3: Add Email DNS Records (For Resend)

**In the same DNS Zone Editor, also add email records:**

1. **DKIM:**
   - Type: `TXT`
   - Name: `resend._domainkey`
   - Value: (from Resend dashboard)
   - TTL: `3600`

2. **SPF - MX:**
   - Type: `MX`
   - Name: `send`
   - Value: `feedback-smtp.us-east-1.amazonses.com` (or from Resend)
   - Priority: `10`
   - TTL: `3600`

3. **SPF - TXT:**
   - Type: `TXT`
   - Name: `send`
   - Value: `v=spf1 include:amazonses.com ~all` (or from Resend)
   - TTL: `3600`

4. **DMARC (Optional):**
   - Type: `TXT`
   - Name: `_dmarc`
   - Value: (from Resend)
   - TTL: `3600`

5. **Save all records**

### Step 4: Wait and Verify

⏰ **Wait 10-60 minutes** for DNS propagation

1. **In Vercel:**
   - Go back to Settings → Domains
   - Click **"Refresh"** next to your domains
   - Status should change to **"Valid Configuration"** ✅

2. **Test your website:**
   - Visit `https://truckmateslogistic.com`
   - Should load your app from Vercel! 🎉

---

## Quick Checklist

- [ ] Click "Edit" on domain in Vercel to see DNS records
- [ ] Copy DNS records from Vercel
- [ ] Log in to Hostinger DNS Zone Editor
- [ ] Remove old A records (if any)
- [ ] Add Vercel DNS records (A or CNAME)
- [ ] Add email DNS records (for Resend)
- [ ] Save all records
- [ ] Wait 10-60 minutes
- [ ] Click "Refresh" in Vercel
- [ ] Verify status shows "Valid Configuration"
- [ ] Test website

---

## Troubleshooting

### Still showing "Invalid Configuration"?

1. **Wait longer** - DNS can take up to 48 hours (usually 10-60 min)
2. **Check DNS propagation:**
   - Use [whatsmydns.net](https://www.whatsmydns.net)
   - Enter your domain and check if records are updated
3. **Verify records in Hostinger:**
   - Make sure records are saved correctly
   - Check for typos in values
4. **Click "Refresh" in Vercel:**
   - Sometimes Vercel needs manual refresh

### Can't find DNS records in Vercel?

1. Click **"Edit"** on the domain
2. Look for **"Configuration"** or **"DNS Records"** section
3. Vercel will show exactly what to add

---

**Once DNS is configured, your domains will show "Valid Configuration" and your site will be live!** 🚀

