# Adding DNS Records in Hostinger for Resend Email

## Overview
- Your website stays on Vercel (no changes needed)
- We're only adding email DNS records in Hostinger
- These records allow Resend to send emails from your domain

---

## Step-by-Step Instructions for Hostinger

### Step 1: Log in to Hostinger

1. Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Log in with your Hostinger account

### Step 2: Access DNS Management

1. In the Hostinger dashboard, find **"Domains"** section
2. Click on **"truckmateslogistics.com"** (or click "Manage" next to it)
3. Look for **"DNS / Name Servers"** or **"DNS Zone Editor"** or **"Advanced DNS"**
4. Click on it to open DNS management

**Note:** If you can't find DNS settings, look for:
- "DNS Zone"
- "DNS Records"
- "Advanced"
- "DNS Management"

### Step 3: Add DKIM Record (TXT)

1. Click **"Add Record"** or **"Add DNS Record"**
2. Select **Type**: `TXT`
3. Enter **Name/Host**: `resend._domainkey`
   - ⚠️ **Important:** Enter exactly `resend._domainkey` (don't add your domain name)
4. Enter **Value/Content**: Copy the full value from Resend (starts with `p=MIGfMA0GCSqGSIb3DQEB...`)
5. **TTL**: Leave as default or set to `3600`
6. Click **"Add"** or **"Save"**

### Step 4: Add SPF Records

You need to add **2 records** for SPF:

#### Record 1: MX Record
1. Click **"Add Record"**
2. Select **Type**: `MX`
3. Enter **Name/Host**: `send`
   - ⚠️ Just `send`, not `send.truckmateslogistics.com`
4. Enter **Value/Content**: `feedback-smtp.us-east-1.amazonses.com` (or what Resend shows)
5. **Priority**: `10`
6. **TTL**: Default or `3600`
7. Click **"Add"**

#### Record 2: TXT Record for SPF
1. Click **"Add Record"**
2. Select **Type**: `TXT`
3. Enter **Name/Host**: `send`
4. Enter **Value/Content**: `v=spf1 include:amazonses.com ~all` (or what Resend shows)
5. **TTL**: Default or `3600`
6. Click **"Add"**

### Step 5: Add DMARC Record (Optional but Recommended)

1. Click **"Add Record"**
2. Select **Type**: `TXT`
3. Enter **Name/Host**: `_dmarc`
   - ⚠️ Just `_dmarc`, not `_dmarc.truckmateslogistics.com`
4. Enter **Value/Content**: `v=DMARC1; p=none;` (or what Resend shows)
5. **TTL**: Default or `3600`
6. Click **"Add"**

### Step 6: Verify All Records Are Added

You should now have these records in Hostinger:

✅ `resend._domainkey` (TXT)  
✅ `send` (MX)  
✅ `send` (TXT)  
✅ `_dmarc` (TXT) - Optional

### Step 7: Wait for DNS Propagation

⏰ **Wait 5-30 minutes** for DNS changes to propagate

### Step 8: Verify in Resend

1. Go back to Resend dashboard → **"Domains"**
2. Find `truckmateslogistics.com`
3. Click **"Verify"** or **"Check Status"**
4. Status should change to **"Verified"** ✅

---

## Troubleshooting

### Can't Find DNS Settings in Hostinger?

**Option 1: Use Hostinger's hPanel**
- Log in to hPanel
- Go to **"Domains"** → **"Manage"** → **"DNS Zone Editor"**

**Option 2: Check if Domain Uses External Nameservers**
- If your domain uses Cloudflare or other nameservers, add records there instead
- Check nameservers in Hostinger → Domain → Nameservers

**Option 3: Contact Hostinger Support**
- They can help you access DNS settings
- Live chat is usually available

### Records Not Showing Up?

1. **Wait longer** - DNS can take up to 48 hours (usually 5-30 min)
2. **Check record names** - Make sure you entered exactly:
   - `resend._domainkey` (not `resend._domainkey.truckmateslogistics.com`)
   - `send` (not `send.truckmateslogistics.com`)
   - `_dmarc` (not `_dmarc.truckmateslogistics.com`)
3. **Verify values** - Copy-paste exact values from Resend (no extra spaces)

### Still Having Issues?

1. **Use DNS checker**: [mxtoolbox.com/TXTLookup.aspx](https://mxtoolbox.com/TXTLookup.aspx)
   - Enter `truckmateslogistics.com`
   - Check if your TXT records appear
2. **Contact Hostinger support** - They can help add records
3. **Contact Resend support** - They can verify your DNS setup

---

## Important Notes

✅ **Your website on Vercel is NOT affected** - These are only email records  
✅ **Keep your existing DNS records** - Don't delete A records pointing to Vercel  
✅ **Domain stays on Vercel** - Only email sending uses these new records  
✅ **Can take up to 48 hours** - But usually works in 5-30 minutes

---

## After Verification

Once verified in Resend:

1. Update your `.env.local` (for local development):
   ```env
   RESEND_FROM_EMAIL=TruckMates <notifications@truckmateslogistics.com>
   ```

2. Update Vercel environment variables:
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Add/Update: `RESEND_FROM_EMAIL` = `TruckMates <notifications@truckmateslogistics.com>`
   - Redeploy your app

3. Test it:
   - Go to your app → Settings
   - Click "Send Test Email"
   - Check your inbox! 📧

