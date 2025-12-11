# Setup Supabase Storage Bucket for Document Upload

## The Error

If you see "bucket not found" error, it means the `documents` storage bucket doesn't exist in your Supabase project.

## Quick Fix: Create the Bucket

### Step 1: Go to Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project

### Step 2: Create Storage Bucket

1. Click **"Storage"** in the left sidebar
2. Click **"Create a new bucket"** button
3. Fill in:
   - **Name:** `documents` (must be exactly this name)
   - **Public bucket:** Toggle **OFF** (make it Private)
   - Click **"Create bucket"**

### Step 3: Set Storage Policies

After creating the bucket, you need to add policies so users can upload/read files:

1. Click on the **"documents"** bucket you just created
2. Go to **"Policies"** tab
3. Click **"New Policy"** → **"For full customization"**

#### Policy 1: Allow Upload (INSERT)

**Policy Name:** `Users can upload documents`

**Policy Definition:**
```sql
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');
```

Click **"Review"** → **"Save policy"**

#### Policy 2: Allow Read (SELECT)

**Policy Name:** `Users can read documents`

**Policy Definition:**
```sql
CREATE POLICY "Users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

Click **"Review"** → **"Save policy"**

#### Policy 3: Allow Delete (DELETE)

**Policy Name:** `Users can delete documents`

**Policy Definition:**
```sql
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
```

Click **"Review"** → **"Save policy"**

### Step 4: Verify

1. Go back to **"Storage"** → **"Buckets"**
2. You should see the `documents` bucket listed
3. It should show **3 policies** (Upload, Read, Delete)

## Alternative: Use SQL Editor

If you prefer using SQL, you can run this in Supabase SQL Editor:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to read
CREATE POLICY "Users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to delete
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
```

## After Setup

1. **Refresh your browser** (the app should now work)
2. **Try uploading a document again**
3. The error should be gone!

## Troubleshooting

### "Bucket already exists" error
- The bucket might already exist but policies are missing
- Check the Policies tab and add the 3 policies above

### "Permission denied" error
- Make sure you added all 3 policies
- Check that you're logged in as an authenticated user

### Still not working?
- Check browser console for detailed error messages
- Verify you're using the correct Supabase project
- Make sure your `.env.local` has the correct Supabase URL and keys
