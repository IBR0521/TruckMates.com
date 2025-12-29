# Platform Connection Issues - Quick Fix Guide

If your platform (Next.js app) is not connecting to Supabase, follow these steps:

## ✅ Step 1: Check Environment Variables

Your `.env.local` file must have these two required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**To get these values:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## ✅ Step 2: Verify .env.local Exists and Has Values

Check if your `.env.local` file exists and has real values (not placeholders):

```bash
# In your project root directory
cat .env.local
```

Make sure:
- ✅ File exists
- ✅ `NEXT_PUBLIC_SUPABASE_URL` starts with `https://` (not `https://your-project-id...`)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` has a long key value (not `your-anon-key-here`)

## ✅ Step 3: Restart Your Dev Server

After updating `.env.local`, **you MUST restart the Next.js dev server**:

1. **Stop the server:** Press `Ctrl+C` in the terminal where `npm run dev` is running
2. **Start it again:**
   ```bash
   npm run dev
   ```

**Important:** Environment variables are only loaded when the server starts. Changes won't take effect until you restart.

## ✅ Step 4: Check for Errors in Terminal

Look at your terminal where `npm run dev` is running. You should see:

```
✓ Ready on http://localhost:3000
```

If you see errors about missing environment variables, go back to Step 1.

## ✅ Step 5: Check Browser Console

1. Open your app in browser (http://localhost:3000)
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Check the **Console** tab for errors
4. Check the **Network** tab for failed requests to Supabase

Common errors:
- `NEXT_PUBLIC_SUPABASE_URL is not defined` → Environment variable missing
- `Failed to fetch` → Connection issue or wrong URL
- `Invalid API key` → Wrong anon key

## ✅ Step 6: Test Supabase Connection

Try accessing your Supabase project directly:
1. Go to https://supabase.com/dashboard
2. Make sure you can access your project
3. Check if Supabase status is green (no service issues)

## 🔧 Quick Checklist

- [ ] `.env.local` file exists in project root
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set (not a placeholder)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set (not a placeholder)
- [ ] Dev server was restarted after setting env vars
- [ ] No errors in terminal when starting `npm run dev`
- [ ] Browser console shows no Supabase connection errors

## 🚨 If Still Not Working

1. **Verify Supabase project is active:**
   - Go to Supabase Dashboard
   - Make sure your project is not paused

2. **Check if dev server is running:**
   ```bash
   # Make sure you're in the project directory
   cd "/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)"
   npm run dev
   ```

3. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or open in incognito/private window

4. **Check network/firewall:**
   - Make sure nothing is blocking connections to Supabase

---

**Most Common Issue:** Environment variables not set correctly or dev server not restarted after updating `.env.local`

