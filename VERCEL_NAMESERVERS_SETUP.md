# Using Vercel Nameservers - Complete Guide

## ✅ You're Using Vercel Nameservers - This Works!

I see you're changing nameservers to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**This is a valid approach!** When you use Vercel nameservers, Vercel manages all DNS records.

---

## Step 1: Save Nameservers in Hostinger

1. **Make sure both nameservers are entered:**
   - `ns1.vercel-dns.com` ✅
   - `ns2.vercel-dns.com` ✅

2. **Click "Save"** button (purple button at bottom)

3. **Wait for confirmation** - This may take a few minutes

---

## Step 2: Add DNS Records in Vercel (Not Hostinger!)

**Important:** Once you use Vercel nameservers, you manage DNS in Vercel, not Hostinger!

### In Vercel:

1. **Go to Vercel** → Your Project → Settings → Domains
2. **Click on your domain** `www.truckmateslogistic.com`
3. **Look for "DNS Records" or "DNS Configuration"** section
4. **Add these records:**

   **For root domain (if needed):**
   - Type: `A` or `CNAME`
   - Name: `@`
   - Value: (from Vercel's instructions)

   **For www:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com`

---

## Step 3: Add Email DNS Records in Vercel

**You also need to add email DNS records for Resend in Vercel:**

1. **In Vercel DNS settings**, add these records:

   **DKIM:**
   - Type: `TXT`
   - Name: `resend._domainkey`
   - Value: (from Resend dashboard)

   **SPF - MX:**
   - Type: `MX`
   - Name: `send`
   - Value: `feedback-smtp.us-east-1.amazonses.com`
   - Priority: `10`

   **SPF - TXT:**
   - Type: `TXT`
   - Name: `send`
   - Value: `v=spf1 include:amazonses.com ~all`

   **DMARC (Optional):**
   - Type: `TXT`
   - Name: `_dmarc`
   - Value: (from Resend)

---

## Alternative: Keep Hostinger Nameservers

**If you prefer to manage DNS in Hostinger** (easier for email records):

1. **In Hostinger**, select **"Use Hostinger nameservers (recommended)"**
2. **Click "Save"**
3. **Then add DNS records in Hostinger** (as I explained before)
4. **Add email DNS records in Hostinger**

---

## Which Approach is Better?

### Option A: Vercel Nameservers (What you're doing)
- ✅ Vercel manages everything
- ✅ Automatic DNS updates
- ⚠️ Need to add email records in Vercel
- ⚠️ Less control over DNS

### Option B: Hostinger Nameservers (Alternative)
- ✅ Keep DNS management in Hostinger
- ✅ Easier to add email records
- ✅ More control
- ⚠️ Need to manually add Vercel DNS records

---

## Recommendation

**For your situation, I recommend Option B (Hostinger nameservers):**

1. **In Hostinger**, select **"Use Hostinger nameservers (recommended)"**
2. **Click "Save"**
3. **Then add DNS records in Hostinger:**
   - Vercel DNS records (A/CNAME)
   - Email DNS records (DKIM, SPF, DMARC)

**This is simpler** because you can add all records in one place (Hostinger).

---

## What to Do Now

**If you want to continue with Vercel nameservers:**
1. ✅ Save nameservers in Hostinger
2. ✅ Add DNS records in Vercel
3. ✅ Add email DNS records in Vercel

**If you want to use Hostinger nameservers (recommended):**
1. ✅ Select "Use Hostinger nameservers (recommended)"
2. ✅ Save
3. ✅ Add all DNS records in Hostinger (Vercel + Email)

---

**Which approach do you prefer?** I can guide you through either one! 🚀

