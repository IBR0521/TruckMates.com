# How to Verify Your Domain in Resend

## Why Verify Your Domain?

✅ **Better deliverability** - Emails from verified domains are less likely to go to spam  
✅ **Professional appearance** - Emails come from `notifications@yourdomain.com` instead of `onboarding@resend.dev`  
✅ **Brand trust** - Recipients see your domain name, not Resend's default domain  
✅ **Higher sending limits** - Verified domains have better reputation

---

## Step-by-Step Guide

### Step 1: Go to Resend Dashboard

1. Log in to [resend.com](https://resend.com)
2. Click on **"Domains"** in the left sidebar
3. Click the **"Add Domain"** button

### Step 2: Enter Your Domain

1. Enter your domain name (e.g., `yourdomain.com` or `example.com`)
   - ⚠️ **Don't include** `www` or `http://` or `https://`
   - ✅ **Just the domain**: `yourdomain.com`
2. Click **"Add Domain"**

### Step 3: Add DNS Records

Resend will show you DNS records that need to be added to your domain. You'll typically see:

#### Required Records:

1. **SPF Record** (TXT record)
   - Name: `@` or your domain root
   - Value: `v=spf1 include:resend.com ~all`
   - TTL: 3600 (or default)

2. **DKIM Records** (TXT records)
   - Usually 2-3 records with names like:
     - `resend._domainkey`
     - `resend1._domainkey`
     - `resend2._domainkey`
   - Each has a unique value provided by Resend

3. **DMARC Record** (TXT record) - Optional but recommended
   - Name: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`
   - TTL: 3600

### Step 4: Add Records to Your Domain Provider

The steps vary by provider. Here are common ones:

#### If using **Cloudflare**:
1. Go to your domain in Cloudflare dashboard
2. Click **"DNS"** → **"Records"**
3. Click **"Add record"**
4. For each record:
   - Select **Type**: `TXT`
   - Enter **Name**: (from Resend, e.g., `@` or `resend._domainkey`)
   - Enter **Content**: (the value from Resend)
   - TTL: `Auto` or `3600`
   - Click **"Save"**

#### If using **GoDaddy**:
1. Go to GoDaddy Domain Manager
2. Click on your domain
3. Go to **"DNS"** tab
4. Scroll to **"Records"** section
5. Click **"Add"** for each record
6. Select **Type**: `TXT`
7. Enter **Name** and **Value** from Resend
8. Click **"Save"**

#### If using **Namecheap**:
1. Log in to Namecheap
2. Go to **"Domain List"**
3. Click **"Manage"** next to your domain
4. Go to **"Advanced DNS"** tab
5. Click **"Add New Record"**
6. Select **Type**: `TXT Record`
7. Enter **Host**: (from Resend)
8. Enter **Value**: (from Resend)
9. TTL: `Automatic`
10. Click **"Save"**

#### If using **Google Domains / Google Workspace**:
1. Go to Google Domains
2. Click on your domain
3. Go to **"DNS"** section
4. Scroll to **"Custom resource records"**
5. Click **"Add"**
6. Select **Type**: `TXT`
7. Enter **Name** and **Data** from Resend
8. Click **"Save"**

#### If using **AWS Route 53**:
1. Go to Route 53 in AWS Console
2. Click **"Hosted zones"**
3. Select your domain
4. Click **"Create record"**
5. Select **Record type**: `TXT`
6. Enter **Record name** and **Value** from Resend
7. Click **"Create records"**

### Step 5: Wait for DNS Propagation

⏰ **This can take 5 minutes to 48 hours**, but usually takes:
- **5-15 minutes** for most providers
- **Up to 24 hours** in rare cases

### Step 6: Verify in Resend

1. Go back to Resend dashboard → **"Domains"**
2. You'll see your domain with status:
   - 🟡 **Pending** - DNS records are being checked
   - 🟢 **Verified** - Domain is ready to use!
   - 🔴 **Failed** - Check DNS records again

3. Click **"Verify"** or **"Check Status"** to manually trigger verification

### Step 7: Update Your Environment Variables

Once your domain is verified:

1. **For Local Development** (`.env.local`):
   ```env
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=TruckMates <notifications@yourdomain.com>
   ```
   - Replace `yourdomain.com` with your actual domain
   - You can use any email address on your domain (e.g., `notifications@`, `noreply@`, `alerts@`)

2. **For Vercel (Production)**:
   - Go to Vercel → Your Project → **Settings** → **Environment Variables**
   - Add or update:
     - **Name**: `RESEND_FROM_EMAIL`
     - **Value**: `TruckMates <notifications@yourdomain.com>`
     - **Environments**: All (Production, Preview, Development)
   - Click **"Save"**
   - **Redeploy** your app

### Step 8: Test It!

1. Go to your app → **Settings** page
2. Check that email configuration shows as **"✓ Email Service Configured"**
3. Click **"Send Test Email"**
4. Check your inbox - email should come from `notifications@yourdomain.com`!

---

## Troubleshooting

### Domain Verification Failed?

1. **Check DNS records are correct:**
   - Use a DNS checker tool like [mxtoolbox.com](https://mxtoolbox.com/TXTLookup.aspx)
   - Enter your domain and check if TXT records appear
   - Make sure values match exactly (no extra spaces)

2. **Wait longer:**
   - DNS changes can take up to 48 hours to propagate
   - Try again after 30 minutes

3. **Check record names:**
   - For root domain: use `@` or leave blank (depends on provider)
   - For subdomains: use the full subdomain name

4. **Remove old records:**
   - If you had previous email service, remove old SPF/DKIM records
   - Only keep Resend's records

### Still Having Issues?

1. **Check Resend logs:**
   - Go to Resend → **"Logs"**
   - Look for error messages

2. **Contact Resend support:**
   - They're very helpful and can check your DNS records
   - Email: support@resend.com

3. **Use Resend's default domain for now:**
   - You can still send emails using `onboarding@resend.dev`
   - Just don't set `RESEND_FROM_EMAIL` in environment variables
   - Verify domain later when you have time

---

## Quick Reference

### DNS Records Summary

| Record Type | Name | Value Example |
|------------|------|---------------|
| SPF (TXT) | `@` | `v=spf1 include:resend.com ~all` |
| DKIM (TXT) | `resend._domainkey` | (provided by Resend) |
| DKIM (TXT) | `resend1._domainkey` | (provided by Resend) |
| DKIM (TXT) | `resend2._domainkey` | (provided by Resend) |
| DMARC (TXT) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` |

### Environment Variables

```env
# Required
RESEND_API_KEY=re_your_api_key_here

# Optional (use after domain verification)
RESEND_FROM_EMAIL=TruckMates <notifications@yourdomain.com>
```

---

## What Happens After Verification?

✅ Emails will be sent from your domain  
✅ Better deliverability (less spam)  
✅ Professional appearance  
✅ You can use any email address on your domain (e.g., `notifications@`, `alerts@`, `noreply@`)

**Note:** You can send emails even without domain verification using `onboarding@resend.dev`, but they may go to spam folders.

