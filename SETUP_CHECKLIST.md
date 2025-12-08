# Supabase Setup Checklist

Use this checklist to make sure everything is set up correctly.

## Pre-Setup

- [ ] Node.js installed (check: `node --version`)
- [ ] npm installed (check: `npm --version`)
- [ ] Project dependencies installed (`npm install`)

## Step 1: Supabase Project

- [ ] Created Supabase account
- [ ] Created new project
- [ ] Saved database password
- [ ] Project is ready (green status)

## Step 2: API Keys

- [ ] Opened Settings → API in Supabase
- [ ] Copied Project URL
- [ ] Copied anon public key
- [ ] Keys saved somewhere safe

## Step 3: Environment Variables

- [ ] Created `.env.local` file in project root
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] No extra spaces in values
- [ ] Restarted dev server after adding keys

## Step 4: Database Schema

- [ ] Opened Supabase SQL Editor
- [ ] Opened `supabase/schema.sql` from project
- [ ] Copied ALL SQL code
- [ ] Pasted in Supabase SQL Editor
- [ ] Clicked "Run"
- [ ] Saw "Success" message
- [ ] Verified tables exist (Table Editor)

## Step 5: Storage

- [ ] Created `documents` bucket
- [ ] Set bucket to Private
- [ ] Added upload policy
- [ ] Added read policy
- [ ] Added delete policy

## Step 6: Packages

- [ ] Checked: `npm list @supabase/supabase-js`
- [ ] Checked: `npm list @supabase/ssr`
- [ ] If missing, installed packages

## Step 7: Test Connection

- [ ] Dev server running (`npm run dev`)
- [ ] Opened app in browser
- [ ] Tested connection (browser console)
- [ ] No errors in console

## Step 8: Create Test Data

- [ ] Created a company in Supabase
- [ ] Created a user account
- [ ] Linked user to company
- [ ] Tested creating a driver
- [ ] Verified driver appears in database

## ✅ All Done!

If all checked, Supabase is fully connected and working!

---

## Quick Test Commands

### Test in Terminal:
```bash
# Check if packages installed
npm list @supabase/supabase-js @supabase/ssr

# Check if .env.local exists
cat .env.local

# Restart dev server
npm run dev
```

### Test in Browser Console:
```javascript
// Test Supabase connection
const { createClient } = await import('/lib/supabase/client.js')
const supabase = createClient()
const { data, error } = await supabase.from('drivers').select('*')
console.log('Test:', { data, error })
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Check `.env.local`, restart server |
| "Not authenticated" | User needs to login first |
| "No company found" | Create company, link to user |
| Tables don't exist | Run schema.sql in Supabase |
| Can't upload files | Create storage bucket, add policies |

---

## Need Help?

- 📚 Read `HOW_TO_ADD_SUPABASE.md` for detailed steps
- 📚 Read `SUPABASE_INTEGRATION_GUIDE.md` for complete guide
- 📚 Read `BACKEND_EXAMPLES.md` for code examples

