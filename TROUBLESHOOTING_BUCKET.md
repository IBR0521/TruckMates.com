# Troubleshooting: Storage Bucket Not Found

If you're still getting "Storage bucket 'documents' not found" after running the SQL, follow these steps:

## Step 1: Verify the Bucket Exists

Run this SQL in Supabase SQL Editor to check if the bucket was created:

```sql
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id = 'documents';
```

**Expected Result:** You should see one row with `id = 'documents'`

**If you see no rows:** The bucket wasn't created. Go to Step 2.

**If you see a row:** The bucket exists. The issue might be:
- Wrong Supabase project (check your `.env.local` file)
- API connection issue
- Try refreshing the page and uploading again

## Step 2: Create the Bucket (If it doesn't exist)

### Option A: Using SQL (Recommended)

Run this in Supabase SQL Editor:

```sql
-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
```

### Option B: Using Supabase Dashboard

1. Go to **Storage** in your Supabase dashboard
2. Click **"New bucket"** or **"Create bucket"**
3. Set:
   - **Name**: `documents` (exactly, lowercase)
   - **Public bucket**: **Unchecked** (Private)
4. Click **"Create bucket"**

## Step 3: Verify Your Supabase Connection

Check your `.env.local` file to ensure you're using the correct Supabase project:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Make sure these match the project where you created the bucket.

## Step 4: Check Storage Policies

After creating the bucket, run the full setup from `supabase/storage_bucket_setup.sql` to create the necessary policies.

## Step 5: Test Again

1. Refresh your browser page
2. Try uploading a document again
3. Check the browser console for any additional errors

## Common Issues

### Issue: "Bucket not found" even after creating it
**Solution:** 
- Verify you're using the correct Supabase project (check `.env.local`)
- Make sure the bucket name is exactly `documents` (lowercase, no spaces)
- Try refreshing the page

### Issue: "Permission denied" after creating bucket
**Solution:**
- Run the full `storage_bucket_setup.sql` to create storage policies
- Make sure you're logged in when uploading

### Issue: SQL runs but bucket still not found
**Solution:**
- Check if you're running SQL in the correct Supabase project
- Verify your `.env.local` points to the same project
- Check Supabase dashboard → Storage to see if bucket appears there

## Still Having Issues?

1. Check Supabase dashboard → Storage → you should see the `documents` bucket
2. Check browser console for detailed error messages
3. Verify your Supabase credentials in `.env.local`
4. Make sure you're logged in to the platform when uploading

