# How to Check if Realtime is Active

## ✅ Quick Check

**In the Dashboard Header:**
- Look for the "Realtime Status" button (next to notifications bell)
- **Green checkmark** = Realtime is enabled and working ✅
- **Red X** = Realtime is not enabled ❌
- **Yellow alert** = Status unknown ⚠️

Click the button to see detailed status for each table.

---

## 🔍 Detailed Status Check

### Method 1: Using the Status Checker (Easiest)

1. Go to `/dashboard`
2. Click "Realtime Status" button in header
3. See connection status and table-specific tests
4. Click "Test All Tables" to check each table

### Method 2: Browser Console

Open browser console (F12) and run:

```javascript
// Check if realtime channel can connect
const supabase = window.__supabase || (await import('@/lib/supabase/client')).createClient()
const channel = supabase.channel('test')
channel.subscribe((status) => {
  console.log('Realtime status:', status)
  if (status === 'SUBSCRIBED') {
    console.log('✅ Realtime is ENABLED')
    channel.unsubscribe()
  } else if (status === 'CHANNEL_ERROR') {
    console.log('❌ Realtime is NOT enabled')
    channel.unsubscribe()
  }
})
```

### Method 3: Test Real-Time Updates

1. Open platform in **two browser windows** (or tabs)
2. In window 1: Go to `/dashboard/loads`
3. In window 2: Go to `/dashboard/loads`
4. In window 1: Create or edit a load
5. **If realtime is working:** Window 2 will update automatically
6. **If realtime is NOT working:** Window 2 won't update (need to refresh)

---

## 🛠️ How to Enable Realtime

### Step 1: Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **Database** → **Replication**

### Step 2: Enable Replication for Tables
Enable replication for these tables:
- ✅ `loads`
- ✅ `routes`
- ✅ `drivers`
- ✅ `trucks`
- ✅ `notifications` (optional)

**How to enable:**
- Find each table in the list
- Toggle "Enable Replication" to **ON**
- Or use bulk enable if available

### Step 3: Verify
1. Go back to your platform
2. Click "Realtime Status" button
3. Click "Refresh"
4. Should show ✅ green checkmark

---

## ⚠️ About the Hydration Error

The hydration warning you're seeing is **harmless** - it's from the Cursor IDE browser extension adding `data-cursor-ref` attributes for its own tracking.

**This is NOT a real error** - it's just the browser extension. You can ignore it.

However, I've fixed potential real hydration issues:
- ✅ Fixed localStorage usage in global search (now client-side only)
- ✅ All components properly marked as "use client"
- ✅ No server/client mismatches

---

## 🧪 Testing Realtime

### Test 1: Real-Time Load Updates
1. Open `/dashboard/loads` in two windows
2. Create a new load in window 1
3. Watch it appear in window 2 automatically ✅

### Test 2: Real-Time Dashboard Stats
1. Open `/dashboard` in two windows
2. Create/edit a load in window 1
3. Watch dashboard stats update in window 2 ✅

### Test 3: Real-Time Notifications
1. Enable notifications table replication
2. Create a notification (via API or SQL)
3. See it appear in notifications center automatically ✅

---

## 📊 Status Indicators

### In Code (Browser Console)
```javascript
// Check connection status
console.log('[REALTIME] Connection status:', isConnected)
```

### In UI
- **Green checkmark** = Working ✅
- **Red X** = Not enabled ❌
- **Yellow alert** = Unknown/Checking ⚠️

---

## 🐛 Troubleshooting

### Realtime Status Shows "Not Connected"

**Possible causes:**
1. Replication not enabled in Supabase
   - **Fix:** Enable replication in Supabase Dashboard
2. Network/firewall blocking WebSocket
   - **Fix:** Check network settings
3. Supabase project paused
   - **Fix:** Resume project in Supabase Dashboard

### Tables Show "Not Enabled"

**Fix:**
1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for that specific table
3. Click "Test" button again

### Connection Works But Updates Don't Appear

**Possible causes:**
1. RLS policies blocking updates
   - **Fix:** Check RLS policies allow SELECT
2. Table not in replication list
   - **Fix:** Add table to replication
3. Browser cache
   - **Fix:** Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

---

## 📝 Quick Reference

**Check Status:**
- Click "Realtime Status" button in dashboard header

**Enable Realtime:**
- Supabase Dashboard → Database → Replication → Enable for tables

**Test Realtime:**
- Open two browser windows → Make change in one → See update in other

**Status Colors:**
- 🟢 Green = Working
- 🔴 Red = Not enabled
- 🟡 Yellow = Unknown

---

**Last Updated:** $(date)

