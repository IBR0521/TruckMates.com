# Exact DNS Records to Add in Hostinger

## ✅ You Found "Manage DNS records" - Now Add These!

---

## Step 1: Add Vercel DNS Records

### Record 1: Root Domain (truckmateslogistic.com)

**If Vercel showed you an A Record:**
1. **Type:** Select `A`
2. **Name:** Enter `@` (or leave blank)
3. **Points to / Value:** Enter the IP address from Vercel (usually `76.76.21.21` or similar)
4. **TTL:** `3600` (or leave as default)
5. Click **"Add Record"**

**If Vercel showed you a CNAME:**
1. **Type:** Select `CNAME`
2. **Name:** Enter `@` (or leave blank)
3. **Points to / Value:** Enter `cname.vercel-dns.com` (or what Vercel showed you)
4. **TTL:** `3600`
5. Click **"Add Record"**

### Record 2: www Subdomain (www.truckmateslogistic.com)

1. **Type:** Select `CNAME`
2. **Name:** Enter `www`
3. **Points to / Value:** Enter `cname.vercel-dns.com` (or what Vercel showed you)
4. **TTL:** `3600`
5. Click **"Add Record"**

---

## Step 2: Add Email DNS Records (For Resend)

### Record 3: DKIM

1. **Type:** Select `TXT`
2. **Name:** Enter `resend._domainkey`
3. **Points to / Value:** Copy from Resend dashboard (starts with `p=MIGfMA0GCSqGSIb3DQEB...`)
   - Go to Resend → Domains → Your domain → Copy the DKIM value
4. **TTL:** `3600`
5. Click **"Add Record"**

### Record 4: SPF - MX Record

1. **Type:** Select `MX`
2. **Name:** Enter `send`
3. **Points to / Value:** Enter `feedback-smtp.us-east-1.amazonses.com` (or what Resend shows)
4. **Priority:** Enter `10`
5. **TTL:** `3600`
6. Click **"Add Record"**

### Record 5: SPF - TXT Record

1. **Type:** Select `TXT`
2. **Name:** Enter `send`
3. **Points to / Value:** Enter `v=spf1 include:amazonses.com ~all` (or what Resend shows)
4. **TTL:** `3600`
5. Click **"Add Record"**

### Record 6: DMARC (Optional but Recommended)

1. **Type:** Select `TXT`
2. **Name:** Enter `_dmarc`
3. **Points to / Value:** Copy from Resend dashboard (usually `v=DMARC1; p=none;`)
4. **TTL:** `3600`
5. Click **"Add Record"**

---

## Summary: All Records to Add

| # | Type | Name | Points to / Value | Priority | TTL |
|---|------|------|-------------------|----------|-----|
| 1 | A or CNAME | `@` | (from Vercel) | - | 3600 |
| 2 | CNAME | `www` | `cname.vercel-dns.com` | - | 3600 |
| 3 | TXT | `resend._domainkey` | (from Resend) | - | 3600 |
| 4 | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 | 3600 |
| 5 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | - | 3600 |
| 6 | TXT | `_dmarc` | (from Resend) | - | 3600 |

---

## Important Notes

⚠️ **For Record 1 (Root Domain):**
- Check what Vercel showed you - was it an A record (IP address) or CNAME?
- Use that exact type and value

⚠️ **For Email Records:**
- You need to get the exact values from Resend dashboard
- Go to Resend → Domains → Your domain → Copy the values

⚠️ **Name Field:**
- For root domain: Use `@` or leave blank
- For subdomains: Use the subdomain name (e.g., `www`, `send`)
- For special records: Use exact name (e.g., `resend._domainkey`, `_dmarc`)

---

## Quick Checklist

- [ ] Added Vercel DNS record for root domain (A or CNAME)
- [ ] Added Vercel DNS record for www (CNAME)
- [ ] Added DKIM record (TXT: resend._domainkey)
- [ ] Added SPF MX record (MX: send)
- [ ] Added SPF TXT record (TXT: send)
- [ ] Added DMARC record (TXT: _dmarc) - Optional
- [ ] All records saved

---

## After Adding All Records

1. **Wait 10-60 minutes** for DNS propagation
2. **Go to Vercel** → Settings → Domains
3. **Click "Refresh"** next to your domains
4. **Status should change** to "Valid Configuration" ✅
5. **Test your website:** Visit `https://truckmateslogistic.com`

---

**Start with Record 1 and 2 (Vercel DNS), then add the email records!** 🚀

