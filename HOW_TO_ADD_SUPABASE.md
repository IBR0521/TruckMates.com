# How to Add Supabase to Your SaaS App

## Complete Step-by-Step Guide

### ✅ Step 1: Create Supabase Account & Project (3 minutes)

1. **Go to Supabase:**
   - Visit [https://supabase.com](https://supabase.com)
   - Click "Start your project" or "Sign up"

2. **Sign up:**
   - Use GitHub, Google, or email
   - Verify your email if needed

3. **Create New Project:**
   - Click "New Project" button
   - Fill in:
     - **Name**: `TruckMates` (or any name)
     - **Database Password**: Create a strong password (SAVE THIS!)
     - **Region**: Choose closest to you (e.g., US East, EU West)
   - Click "Create new project"
   - **Wait 1-2 minutes** for setup to complete

---

### ✅ Step 2: Get Your API Keys (1 minute)

1. **In Supabase Dashboard:**
   - Click **"Settings"** (gear icon) in left sidebar
   - Click **"API"** in settings menu

2. **Copy these values:**
   - **Project URL**: Looks like `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: Long string starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   
   **Keep these safe!** You'll need them in the next step.

---

### ✅ Step 3: Add Keys to Your Project (2 minutes)

1. **Create `.env.local` file:**
   ```bash
   # In your project root directory, run:
   touch .env.local
   ```

2. **Open `.env.local` and add:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   
   **Replace:**
   - `https://your-project-id.supabase.co` with your actual Project URL
   - `your-anon-key-here` with your actual anon public key

3. **Save the file**

4. **IMPORTANT: Restart your dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Then start again:
   npm run dev
   ```

---

### ✅ Step 4: Set Up Database Tables (3 minutes)

1. **In Supabase Dashboard:**
   - Click **"SQL Editor"** in left sidebar
   - Click **"New query"** button

2. **Get the SQL schema:**
   - Open `supabase/schema.sql` file from your project
   - **Select ALL** the code (Cmd/Ctrl + A)
   - **Copy** it (Cmd/Ctrl + C)

3. **Paste in Supabase:**
   - Go back to Supabase SQL Editor
   - **Paste** the SQL code (Cmd/Ctrl + V)

4. **Run it:**
   - Click **"Run"** button (or press Cmd/Ctrl + Enter)
   - Wait for "Success. No rows returned" message
   - This creates all your tables, policies, and triggers!

---

### ✅ Step 5: Set Up File Storage (2 minutes)

1. **Create Storage Bucket:**
   - In Supabase Dashboard → Click **"Storage"**
   - Click **"Create a new bucket"**
   - Name: `documents`
   - **Make it Private** (toggle OFF "Public bucket")
   - Click **"Create bucket"**

2. **Set Storage Policies:**
   - Click on **"documents"** bucket
   - Go to **"Policies"** tab
   - Click **"New Policy"** → **"For full customization"**
   - Add this policy:

   ```sql
   CREATE POLICY "Users can upload documents"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'documents');
   ```

   - Click **"Save"**
   - Add another policy:

   ```sql
   CREATE POLICY "Users can read documents"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'documents');
   ```

   - Click **"Save"**
   - Add one more:

   ```sql
   CREATE POLICY "Users can delete documents"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'documents');
   ```

   - Click **"Save"**

---

### ✅ Step 6: Test the Connection (1 minute)

1. **Check if packages are installed:**
   ```bash
   npm list @supabase/supabase-js @supabase/ssr
   ```

2. **If not installed, install them:**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

3. **Test in browser:**
   - Open your app: `http://localhost:3000`
   - Open browser console (F12)
   - Paste this:

   ```javascript
   const { createClient } = await import('/lib/supabase/client.js')
   const supabase = createClient()
   const { data, error } = await supabase.from('drivers').select('*')
   console.log('Supabase Test:', { data, error })
   ```

   - If you see `data: []` and `error: null`, it's working! ✅

---

### ✅ Step 7: Create Your First Company (2 minutes)

After registering a user, you need to create a company:

1. **In Supabase Dashboard:**
   - Go to **"Table Editor"** → **"companies"** table
   - Click **"Insert row"**

2. **Fill in:**
   - **name**: Your Company Name
   - **email**: company@example.com
   - **phone**: +1234567890
   - Click **"Save"**
   - **Copy the ID** (UUID) that was generated

3. **Link user to company:**
   - Go to **"users"** table
   - Find your user (by email)
   - Click to edit
   - Set **company_id**: Paste the UUID you copied
   - Set **role**: `manager`
   - Click **"Save"**

---

## ✅ You're Done! Supabase is Connected!

### What You Can Do Now:

1. **Use Server Actions:**
   - `getDrivers()` - Get all drivers
   - `createDriver()` - Add new driver
   - `updateDriver()` - Update driver
   - `deleteDriver()` - Delete driver
   - Same for trucks, loads, routes, etc.

2. **Use Authentication:**
   - `supabase.auth.signUp()` - Register users
   - `supabase.auth.signInWithPassword()` - Login
   - `supabase.auth.getUser()` - Get current user

3. **Use Storage:**
   - Upload files to `documents` bucket
   - Download files
   - Delete files

---

## Quick Test

Try this in your app:

1. **Register a new manager:**
   - Go to `/register/manager`
   - Fill in the form
   - Submit

2. **Check Supabase:**
   - Go to Supabase Dashboard → **Authentication** → **Users**
   - You should see your new user!

3. **Create a driver:**
   - Go to `/dashboard/drivers/add`
   - Fill in the form
   - Submit

4. **Check database:**
   - Go to Supabase Dashboard → **Table Editor** → **drivers**
   - You should see your new driver!

---

## Troubleshooting

### ❌ "Invalid API key" error
- ✅ Check `.env.local` has correct values
- ✅ Restart dev server: `npm run dev`
- ✅ Make sure no extra spaces in keys

### ❌ "Not authenticated" error
- ✅ User needs to be logged in
- ✅ Check Supabase Dashboard → Authentication → Users

### ❌ "No company found" error
- ✅ Create a company in Supabase
- ✅ Link user to company (set company_id in users table)

### ❌ RLS policy error
- ✅ Make sure you ran the schema SQL
- ✅ Check user has company_id set
- ✅ Verify policies exist in Supabase Dashboard → Authentication → Policies

---

## Next Steps

1. ✅ Supabase is connected
2. ⏭️ Update your pages to use real data
3. ⏭️ Test authentication flow
4. ⏭️ Test creating/updating/deleting records

---

## Files You Have

All backend code is ready:
- ✅ `app/actions/drivers.ts` - Driver operations
- ✅ `app/actions/trucks.ts` - Truck operations  
- ✅ `app/actions/loads.ts` - Load operations
- ✅ `app/actions/routes.ts` - Route operations
- ✅ `lib/supabase/client.ts` - Client connection
- ✅ `lib/supabase/server.ts` - Server connection
- ✅ `supabase/schema.sql` - Database schema

Just follow the steps above and you're ready to go! 🚀

