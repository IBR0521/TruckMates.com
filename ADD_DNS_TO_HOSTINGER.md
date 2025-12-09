# Add DNS Records to Hostinger - Step by Step

## ✅ You Found DNS Records in Vercel - Now Add Them to Hostinger!

---

## Step 1: Copy DNS Records from Vercel

**In Vercel, you should see something like:**

**For root domain (`truckmateslogistic.com`):**
- Type: `A` or `CNAME`
- Name: `@` (or blank)
- Value: (IP address or `cname.vercel-dns.com`)

**For www (`www.truckmateslogistic.com`):**
- Type: `CNAME`
- Name: `www`
- Value: `cname.vercel-dns.com` (or similar)

**Copy these values** - You'll need them!

---

## Step 2: Log in to Hostinger

1. Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Log in with your account

---

## Step 3: Open DNS Zone Editor

1. In Hostinger dashboard, click **"Domains"** in the left sidebar
2. Click on **"truckmateslogistic.com"**
3. Look for one of these options:
   - **"DNS / Name Servers"**
   - **"DNS Zone Editor"**
   - **"Advanced DNS"**
   - **"DNS Management"**
4. Click on it to open DNS settings

---

## Step 4: Remove Old Records (If Any)

1. **Look for existing A records** pointing to Hostinger IP
2. **Delete or remove them** (they might conflict)
3. Keep any other records you need

---

## Step 5: Add Vercel DNS Records

### For Root Domain (`truckmateslogistic.com`):

**If Vercel shows A Record:**
1. Click **"Add Record"** or **"Add DNS Record"**
2. Select **Type:** `A`
3. Enter **Name/Host:** `@` (or leave blank)
4. Enter **Value/Content:** (IP address from Vercel, e.g., `76.76.21.21`)
5. **TTL:** `3600` (or leave as default)
6. Click **"Add"** or **"Save"**

**If Vercel shows CNAME:**
1. Click **"Add Record"**
2. Select **Type:** `CNAME`
3. Enter **Name/Host:** `@` (or leave blank)
4. Enter **Value/Content:** `cname.vercel-dns.com` (or what Vercel shows)
5. **TTL:** `3600`
6. Click **"Add"**

### For www Subdomain (`www.truckmateslogistic.com`):

1. Click **"Add Record"**
2. Select **Type:** `CNAME`
3. Enter **Name/Host:** `www`
4. Enter **Value/Content:** `cname.vercel-dns.com` (or what Vercel shows)
5. **TTL:** `3600`
6. Click **"Add"**

---

## Step 6: Add Email DNS Records (For Resend)

**In the same DNS Zone Editor, also add these for email:**

### DKIM Record:
1. Click **"Add Record"**
2. Select **Type:** `TXT`
3. Enter **Name/Host:** `resend._domainkey`
4. Enter **Value/Content:** (Copy from Resend dashboard - starts with `p=MIGfMA0GCSqGSIb3DQEB...`)
5. **TTL:** `3600`
6. Click **"Add"**

### SPF - MX Record:
1. Click **"Add Record"**
2. Select **Type:** `MX`
3. Enter **Name/Host:** `send`
4. Enter **Value/Content:** `feedback-smtp.us-east-1.amazonses.com` (or from Resend)
5. **Priority:** `10`
6. **TTL:** `3600`
7. Click **"Add"**

### SPF - TXT Record:
1. Click **"Add Record"**
2. Select **Type:** `TXT`
3. Enter **Name/Host:** `send`
4. Enter **Value/Content:** `v=spf1 include:amazonses.com ~all` (or from Resend)
5. **TTL:** `3600`
6. Click **"Add"**

### DMARC Record (Optional):
1. Click **"Add Record"**
2. Select **Type:** `TXT`
3. Enter **Name/Host:** `_dmarc`
4. Enter **Value/Content:** (Copy from Resend dashboard)
5. **TTL:** `3600`
6. Click **"Add"**

---

## Step 7: Save All Records

1. **Make sure all records are saved**
2. **Double-check** that you added:
   - ✅ Vercel DNS records (A or CNAME for root, CNAME for www)
   - ✅ Email DNS records (DKIM, SPF, DMARC)

---

## Step 8: Wait for DNS Propagation

⏰ **Wait 10-60 minutes** for DNS changes to take effect

**This is normal!** DNS changes don't happen instantly.

---

## Step 9: Verify in Vercel

1. **Go back to Vercel** → Your Project → Settings → Domains
2. **Click "Refresh"** next to your domains
3. **Status should change** from "Invalid Configuration" to **"Valid Configuration"** ✅

---

## Step 10: Test Your Website

1. **Visit:** `https://truckmateslogistic.com`
2. **Should load your app from Vercel!** 🎉

---

## Quick Checklist

- [ ] Copied DNS records from Vercel
- [ ] Logged in to Hostinger
- [ ] Opened DNS Zone Editor
- [ ] Removed old A records (if any)
- [ ] Added Vercel DNS record for root domain
- [ ] Added Vercel DNS record for www
- [ ] Added email DNS records (DKIM, SPF, DMARC)
- [ ] Saved all records
- [ ] Waited 10-60 minutes
- [ ] Clicked "Refresh" in Vercel
- [ ] Verified status shows "Valid Configuration"
- [ ] Tested website

---

## Troubleshooting

### Still showing "Invalid Configuration" after 1 hour?

1. **Double-check records in Hostinger:**
   - Make sure they're saved correctly
   - Check for typos
   - Verify values match Vercel exactly

2. **Check DNS propagation:**
   - Use [whatsmydns.net](https://www.whatsmydns.net)
   - Enter your domain
   - See if DNS records are updated globally

3. **Wait longer:**
   - DNS can take up to 48 hours (rare, usually 10-60 min)

---

**Once DNS propagates, your site will be live at `https://truckmateslogistic.com`!** 🚀

