# Fix Resend Domain Verification - Send Emails to Anyone

## 🔴 Current Problem

You're using `onboarding@resend.dev` which only allows sending to **your own email** (`ibr20117o@gmail.com`). To send emails to **anyone** (like employee invitations), you need to verify your domain.

---

## ✅ Solution: Verify Your Domain in Resend

### Step 1: Go to Resend Domains

1. Go to [https://resend.com/domains](https://resend.com/domains)
2. Sign in to your Resend account
3. Click **"Add Domain"** button

### Step 2: Add Your Domain

1. Enter your domain: `truckmateslogistic.com`
2. Click **"Add Domain"**
3. Resend will show you **DNS records** you need to add

---

## 📋 DNS Records to Add in Hostinger

You'll need to add these DNS records in Hostinger:

### 1. **DKIM Record** (TXT)
- **Name/Host:** `resend._domainkey`
- **Type:** `TXT`
- **Value:** (Resend will give you this - looks like: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...`)
- **TTL:** `3600` (or default)

### 2. **SPF Record** (TXT)
- **Name/Host:** `@` (or leave empty/root domain)
- **Type:** `TXT`
- **Value:** `v=spf1 include:resend.com ~all`
- **TTL:** `3600`

### 3. **DMARC Record** (TXT)
- **Name/Host:** `_dmarc`
- **Type:** `TXT`
- **Value:** `v=DMARC1; p=none; rua=mailto:ibr20117o@gmail.com`
- **TTL:** `3600`

---

## 🔧 How to Add DNS Records in Hostinger

### Step 1: Go to Hostinger DNS Settings

1. Log in to [Hostinger](https://www.hostinger.com)
2. Go to **"Domains"** → Select `truckmateslogistic.com`
3. Click **"Manage DNS"** or **"DNS Zone Editor"**

### Step 2: Add Each Record

For each record above:

1. Click **"Add Record"** or **"Add New Record"**
2. Select the **Type** (TXT)
3. Enter the **Name/Host** (e.g., `resend._domainkey`)
4. Enter the **Value** (copy from Resend)
5. Set **TTL** to `3600` (or leave default)
6. Click **"Save"** or **"Add"**

### Step 3: Wait for DNS Propagation

- DNS changes can take **10-30 minutes** to propagate
- Sometimes up to **24 hours** (but usually faster)

---

## ✅ Verify Domain in Resend

1. Go back to [resend.com/domains](https://resend.com/domains)
2. Click on your domain `truckmateslogistic.com`
3. Click **"Verify Domain"** button
4. Resend will check if DNS records are correct
5. If all records are found, domain will be **verified** ✅

---

## 🔄 Update Environment Variable in Vercel

Once domain is verified:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `RESEND_FROM_EMAIL`
3. Change value from:
   - ❌ `onboarding@resend.dev`
   - ✅ `noreply@truckmateslogistic.com` (or `hello@truckmateslogistic.com`)

4. Click **"Save"**
5. **Redeploy** your app (or wait for auto-deploy)

---

## 🧪 Test Email Sending

After domain is verified and environment variable updated:

1. Go to `/dashboard/settings`
2. Click **"Send Test Email"**
3. Should work now! ✅

4. Test employee invitation:
   - Go to `/dashboard/employees`
   - Add employee with **any email address**
   - Should receive invitation email! ✅

---

## ⚠️ Important Notes

### DNS Record Format in Hostinger

When adding DNS records, make sure:

- **DKIM:** Name should be `resend._domainkey` (not `resend._domainkey.truckmateslogistic.com`)
- **SPF:** Name should be `@` or empty (for root domain)
- **DMARC:** Name should be `_dmarc`

### If DNS Records Don't Work

1. **Check record format** - Make sure names are correct
2. **Wait longer** - DNS can take up to 24 hours
3. **Check in Resend** - It will tell you which records are missing
4. **Use DNS checker** - Use [mxtoolbox.com](https://mxtoolbox.com) to verify records

---

## 🎯 Quick Checklist

- [ ] Add domain in Resend
- [ ] Copy DNS records from Resend
- [ ] Add DKIM record in Hostinger
- [ ] Add SPF record in Hostinger
- [ ] Add DMARC record in Hostinger
- [ ] Wait 10-30 minutes
- [ ] Verify domain in Resend
- [ ] Update `RESEND_FROM_EMAIL` in Vercel to `noreply@truckmateslogistic.com`
- [ ] Redeploy app
- [ ] Test email sending

---

## 🚀 After Setup

Once domain is verified:
- ✅ Can send emails to **anyone**
- ✅ Employee invitations will work
- ✅ All email notifications will work
- ✅ Professional email address (`noreply@truckmateslogistic.com`)

---

**Follow these steps and your email sending will work for everyone!** 📧✅

