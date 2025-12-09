# Update DNS Records Based on Vercel's Instructions

## What Vercel is Showing

Vercel has updated DNS records. You need to:

1. **Remove a conflicting AAAA record** (for root domain)
2. **Update A record** to new IP (or keep old one - both work)
3. **Update www CNAME** to new value (or keep old one - both work)

---

## Step 1: Remove AAAA Record in Hostinger

1. **Go to Hostinger DNS records**
2. **Look for AAAA record** with:
   - Type: `AAAA`
   - Name: `@`
   - Value: `2a02:4780:9:1263:0:20b6:8c76:2`
3. **Click "Delete"** on that AAAA record
4. **Confirm deletion**

---

## Step 2: Update A Record (Root Domain)

**You have 2 options:**

### Option A: Use New IP (Recommended by Vercel)
1. **Find the A record** for `@` (currently `76.76.21.21`)
2. **Click "Edit"**
3. **Change Content to:** `216.198.79.1` (new IP from Vercel)
4. **Save**

### Option B: Keep Old IP (Also Works)
- **Keep it as:** `76.76.21.21`
- Vercel says old records will continue to work
- But new IP is recommended

**I recommend Option A** - use the new IP `216.198.79.1`

---

## Step 3: Update www CNAME

**You have 2 options:**

### Option A: Use New CNAME (Recommended by Vercel)
1. **Find the CNAME record** for `www`
2. **Click "Edit"**
3. **Change Content to:** `90d7a3d06c097074.vercel-dns-017.com.` (new value from Vercel)
4. **Save**

### Option B: Keep Old CNAME (Also Works)
- **Keep it as:** `cname.vercel-dns.com`
- Vercel says old records will continue to work
- But new value is recommended

**I recommend Option A** - use the new CNAME value

---

## Quick Action Plan

1. ✅ **Delete AAAA record** in Hostinger (Type: AAAA, Name: @)
2. ✅ **Edit A record** for `@` → Change to `216.198.79.1`
3. ✅ **Edit CNAME record** for `www` → Change to `90d7a3d06c097074.vercel-dns-017.com.`
4. ✅ **Add email DNS records** (if not done yet)
5. ✅ **Wait 10-60 minutes**
6. ✅ **Refresh in Vercel** - should show "Valid Configuration"

---

## Summary

**What to do:**
- Delete AAAA record
- Update A record to `216.198.79.1` (new IP)
- Update www CNAME to `90d7a3d06c097074.vercel-dns-017.com.` (new value)

**Note:** Old values (`76.76.21.21` and `cname.vercel-dns.com`) will still work, but Vercel recommends using the new ones.

---

**Start by deleting the AAAA record, then update the A and CNAME records!** 🚀

