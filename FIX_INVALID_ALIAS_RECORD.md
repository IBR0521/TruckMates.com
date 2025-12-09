# Fix: "The given data is invalid" for ALIAS Record

## The Problem

Hostinger's ALIAS records might not accept IP addresses directly. They might need to point to a domain/hostname instead.

## Solution Options

### Option 1: Disable CDN and Use A Records (Recommended)

**This is the easiest solution:**

1. **Disable CDN in Hostinger:**
   - Go to Hostinger dashboard
   - Find **"CDN"** or **"Website"** settings
   - Look for CDN toggle/switch
   - **Disable CDN** for your domain
   - Wait a few minutes for changes to take effect

2. **Delete the ALIAS record:**
   - Go back to DNS records
   - Click **"Delete"** on the ALIAS record for `@`

3. **Add A record:**
   - Type: `A`
   - Name: `@` (or leave blank)
   - Points to: `76.76.21.21`
   - TTL: `3600`
   - Click **"Add Record"**

4. **Edit the www CNAME:**
   - Click **"Edit"** on the www CNAME record
   - Change Content to: `cname.vercel-dns.com`
   - Save

---

### Option 2: Use CNAME for Root Domain (If Supported)

Some DNS providers allow CNAME for root domain:

1. **Delete the ALIAS record** for `@`

2. **Add CNAME record:**
   - Type: `CNAME`
   - Name: `@` (or leave blank)
   - Points to: `cname.vercel-dns.com`
   - TTL: `3600`
   - Click **"Add Record"**

**Note:** Not all DNS providers support CNAME for root domain. If this doesn't work, use Option 1.

---

### Option 3: Contact Hostinger Support

If neither option works:

1. **Contact Hostinger support** (they have live chat)
2. **Ask them:** "How do I point my domain to an external IP address when CDN is enabled?"
3. They can help you configure it correctly

---

## Recommended: Disable CDN (Option 1)

**This is the best approach:**

1. ✅ Disable CDN in Hostinger
2. ✅ Delete ALIAS record
3. ✅ Add A record pointing to Vercel IP
4. ✅ Edit www CNAME to point to Vercel

---

## Quick Steps for Option 1

1. **Find CDN settings:**
   - In Hostinger dashboard, look for:
     - "CDN" section
     - "Website" → "CDN"
     - "Advanced" → "CDN"
   - **Disable CDN**

2. **Wait 2-5 minutes** for changes

3. **Go back to DNS records**

4. **Delete ALIAS record** for `@`

5. **Add A record:**
   - Type: `A`
   - Name: `@`
   - Points to: `76.76.21.21`
   - TTL: `3600`

6. **Edit www CNAME:**
   - Change to: `cname.vercel-dns.com`

---

**Try Option 1 first - disable CDN, then add A record!** This should work! 🚀

