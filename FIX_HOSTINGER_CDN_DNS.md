# Fix: "A can't be added when CDN is enabled" in Hostinger

## The Problem

Hostinger has CDN enabled for your domain, which uses ALIAS records instead of A records. You can't add A records when CDN is active.

## Solution: Edit the Existing ALIAS Record

Instead of adding a new A record, **edit the existing ALIAS record** to point to Vercel!

---

## Step 1: Edit the ALIAS Record for Root Domain

1. **Find the ALIAS record** in your DNS records table:
   - Type: `ALIAS`
   - Name: `@`
   - Content: `truckmateslogistic.com.cdn.hstgr.net`

2. **Click "Edit"** on that ALIAS record

3. **Change the "Content" field:**
   - **From:** `truckmateslogistic.com.cdn.hstgr.net`
   - **To:** `76.76.21.21` (Vercel's IP address)

4. **Keep Type as:** `ALIAS` (don't change it)

5. **Click "Save"** or "Update"

---

## Step 2: Edit the CNAME Record for www

1. **Find the CNAME record** for `www`:
   - Type: `CNAME`
   - Name: `www`
   - Content: `www.truckmateslogistic.com.cdn.hstgr.net`

2. **Click "Edit"** on that CNAME record

3. **Change the "Content" field:**
   - **From:** `www.truckmateslogistic.com.cdn.hstgr.net`
   - **To:** `cname.vercel-dns.com`

4. **Click "Save"**

---

## Alternative: Disable CDN (If You Want to Use A Records)

If you prefer to use A records instead:

1. **Go to Hostinger dashboard**
2. **Find CDN settings** (might be in Website settings or Advanced)
3. **Disable CDN** for your domain
4. **Wait a few minutes** for changes to take effect
5. **Then you can add A records** normally

**But editing the ALIAS record is easier!** ✅

---

## Step 3: Add Email DNS Records

After editing the website records, add email DNS records:

### DKIM:
- Type: `TXT`
- Name: `resend._domainkey`
- Content: (from Resend dashboard)
- TTL: `3600`
- Click "Add Record"

### SPF - MX:
- Type: `MX`
- Name: `send`
- Content: `feedback-smtp.us-east-1.amazonses.com`
- Priority: `10`
- TTL: `3600`
- Click "Add Record"

### SPF - TXT:
- Type: `TXT`
- Name: `send`
- Content: `v=spf1 include:amazonses.com ~all`
- TTL: `3600`
- Click "Add Record"

### DMARC:
- Type: `TXT`
- Name: `_dmarc`
- Content: (from Resend dashboard)
- TTL: `3600`
- Click "Add Record"

---

## Quick Action Plan

1. ✅ **Edit ALIAS record** for `@` → Change to `76.76.21.21`
2. ✅ **Edit CNAME record** for `www` → Change to `cname.vercel-dns.com`
3. ✅ **Add email DNS records** (DKIM, SPF, DMARC)
4. ✅ **Wait 10-60 minutes** for DNS propagation
5. ✅ **Refresh in Vercel** to verify

---

## Summary

**Don't try to add a new A record!** Instead:
- **Edit the existing ALIAS record** to point to Vercel's IP
- **Edit the existing CNAME record** for www to point to Vercel

This will work even with CDN enabled! 🚀

