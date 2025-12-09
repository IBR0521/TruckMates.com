# Add Resend DNS Records to Hostinger

## Step-by-Step Instructions

### Step 1: Copy DNS Records from Resend

From your Resend dashboard, you need to add these DNS records:

#### 1. Domain Verification (DKIM)
- **Type:** `TXT`
- **Name:** `resend._domainkey`
- **Content:** `p=MIGfMA0GCSqGSIb3DQEB...` (copy the full value from Resend)
- **TTL:** `Auto` or `3600`

#### 2. Enable Sending (SPF) - Record 1
- **Type:** `MX`
- **Name:** `send`
- **Content:** `feedback-smtp.us-east-...` (copy the full value from Resend)
- **TTL:** `Auto` or `3600`
- **Priority:** `10`

#### 3. Enable Sending (SPF) - Record 2
- **Type:** `TXT`
- **Name:** `send`
- **Content:** `v=spf1 include:amazons...` (copy the full value from Resend)
- **TTL:** `Auto` or `3600`

#### 4. DMARC (Optional but Recommended)
- **Type:** `TXT`
- **Name:** `_dmarc`
- **Content:** `v=DMARC1; p=none;`
- **TTL:** `Auto` or `3600`

---

### Step 2: Add Records in Hostinger

1. **Go to Hostinger hPanel:**
   - Log in to your Hostinger account
   - Go to **Domains** → **truckmateslogistics.com**

2. **Go to DNS Management:**
   - Click **"DNS / Nameservers"** or **"DNS Zone Editor"**
   - Or go to **"Advanced"** → **"DNS Zone Editor"**

3. **Add Each Record:**

   **For DKIM (TXT record):**
   - Click **"Add Record"** or **"+"**
   - **Type:** Select `TXT`
   - **Name/Host:** `resend._domainkey`
   - **Value/Content:** Paste the full DKIM value from Resend
   - **TTL:** `3600` (or leave default)
   - Click **"Save"** or **"Add"**

   **For SPF - MX Record:**
   - Click **"Add Record"**
   - **Type:** Select `MX`
   - **Name/Host:** `send`
   - **Value/Content:** Paste the MX value (e.g., `feedback-smtp.us-east-...`)
   - **Priority:** `10`
   - **TTL:** `3600`
   - Click **"Save"**

   **For SPF - TXT Record:**
   - Click **"Add Record"**
   - **Type:** Select `TXT`
   - **Name/Host:** `send`
   - **Value/Content:** Paste the SPF value (e.g., `v=spf1 include:amazons...`)
   - **TTL:** `3600`
   - Click **"Save"**

   **For DMARC (Optional):**
   - Click **"Add Record"**
   - **Type:** Select `TXT`
   - **Name/Host:** `_dmarc`
   - **Value/Content:** `v=DMARC1; p=none;`
   - **TTL:** `3600`
   - Click **"Save"**

---

### Step 3: Wait for DNS Propagation

- **Wait 10-30 minutes** (can take up to 24 hours)
- Resend will automatically check and verify
- Status will change from "Pending" to "Verified" in Resend dashboard

---

### Step 4: Set RESEND_FROM_EMAIL in Vercel

Once domain is verified:

1. **Go to Vercel Dashboard:**
   - Settings → Environment Variables

2. **Add:**
   - **Key:** `RESEND_FROM_EMAIL`
   - **Value:** `noreply@truckmateslogistics.com` (or `hello@truckmateslogistics.com`)
   - **Environments:** Production

3. **Redeploy** your app

---

## Quick Checklist

- [ ] Copy all DNS records from Resend dashboard
- [ ] Add DKIM record (TXT: `resend._domainkey`)
- [ ] Add SPF MX record (MX: `send`)
- [ ] Add SPF TXT record (TXT: `send`)
- [ ] Add DMARC record (TXT: `_dmarc`) - optional
- [ ] Wait 10-30 minutes for DNS propagation
- [ ] Check Resend dashboard - status should change to "Verified"
- [ ] Set `RESEND_FROM_EMAIL` in Vercel
- [ ] Redeploy app
- [ ] Test sending invitation email

---

**Add these DNS records in Hostinger, wait for verification, then set the environment variable!** 📧

