# Next Steps After Running Database Schema

## ✅ Step 1: Verify Tables Were Created

1. **In Supabase Dashboard:**
   - Click **"Table Editor"** in the left sidebar
   - You should see these tables:
     - `users`
     - `companies`
     - `drivers`
     - `trucks`
     - `routes`
     - `loads`
     - `invoices`
     - `expenses`
     - `settlements`
     - `maintenance`
     - `ifta_reports`
     - `documents`

2. **If you see all these tables:** ✅ Database is set up correctly!

---

## ✅ Step 2: Create Storage Bucket (for documents)

1. **In Supabase Dashboard:**
   - Click **"Storage"** in the left sidebar
   - Click **"Create a new bucket"** button

2. **Fill in:**
   - **Name**: `documents`
   - **Public bucket**: Toggle OFF (make it Private)
   - Click **"Create bucket"**

3. **Set Storage Policies:**
   - Click on the **"documents"** bucket you just created
   - Go to **"Policies"** tab
   - Click **"New Policy"** → **"For full customization"**
   
   **Add these 3 policies:**

   **Policy 1 - Upload:**
   ```sql
   CREATE POLICY "Users can upload documents"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'documents');
   ```

   **Policy 2 - Read:**
   ```sql
   CREATE POLICY "Users can read documents"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'documents');
   ```

   **Policy 3 - Delete:**
   ```sql
   CREATE POLICY "Users can delete documents"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'documents');
   ```

   - Click **"Save"** after each policy

---

## ✅ Step 3: Test Your Connection

1. **Open your app:**
   - Go to: `http://localhost:3000`
   - Make sure your dev server is running

2. **Try registering a user:**
   - Go to `/register/manager` or `/register/user`
   - Fill in the form and submit
   - Check Supabase Dashboard → **Authentication** → **Users**
   - You should see your new user!

3. **Test creating a driver:**
   - Login to your app
   - Go to `/dashboard/drivers/add`
   - Fill in the form and submit
   - Check Supabase Dashboard → **Table Editor** → **drivers**
   - You should see your new driver!

---

## ✅ Step 4: Create Your First Company

After registering a user, you need to create a company:

1. **In Supabase Dashboard:**
   - Go to **"Table Editor"** → **"companies"** table
   - Click **"Insert row"**

2. **Fill in:**
   - **name**: Your Company Name (e.g., "My Trucking Company")
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

## 🎉 You're Done!

Your Supabase backend is now fully set up and connected to your app!

### What You Can Do Now:

- ✅ Register users
- ✅ Create companies
- ✅ Add drivers, trucks, routes, loads
- ✅ Manage invoices, expenses, settlements
- ✅ Track maintenance
- ✅ Generate IFTA reports
- ✅ Upload documents

---

## Troubleshooting

### ❌ "Not authenticated" error
- User needs to login first
- Check Supabase Dashboard → Authentication → Users

### ❌ "No company found" error
- Create a company in Supabase
- Link user to company (set company_id in users table)

### ❌ Can't upload files
- Make sure storage bucket "documents" exists
- Make sure storage policies are set

### ❌ Tables don't exist
- Re-run the schema.sql in SQL Editor
- Check for any error messages

---

## Next: Start Using Your App!

Your app is now fully connected to Supabase. Start using it and test all the features!

