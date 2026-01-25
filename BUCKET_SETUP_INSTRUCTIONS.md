# Storage Bucket Setup Instructions

## Error: "Bucket not found"

If you're seeing the error **"Bucket not found"** or **"Bucket 'documents' not found"**, you need to create the storage bucket in Supabase.

## Quick Setup (2 Methods)

### Method 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**
4. Set the bucket details:
   - **Name**: `documents`
   - **Public bucket**: **Unchecked** (Private)
   - Click **"Create bucket"**

5. After creating the bucket, you need to set up storage policies. Go to **SQL Editor** in Supabase and run the SQL from `supabase/storage_bucket_setup.sql`

### Method 2: Using SQL Editor (Faster)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New query"**
4. Copy and paste the entire contents of `supabase/storage_bucket_setup.sql`
5. Click **"Run"** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

This will:
- Create the `documents` bucket
- Set up all necessary storage policies for authenticated users
- Allow managers to view company documents

## Verify Setup

After running the SQL, verify the bucket exists:

1. Go to **Storage** in Supabase dashboard
2. You should see a bucket named `documents`
3. Try uploading a document again in the platform

## File Location

The SQL setup file is located at:
- `supabase/storage_bucket_setup.sql`

Or use the simpler version:
- `CREATE_BUCKET_SQL.sql` (just creates the bucket, no policies)

## Troubleshooting

If you still get errors after creating the bucket:

1. **Check bucket name**: Make sure it's exactly `documents` (lowercase, no spaces)
2. **Check bucket visibility**: It should be **Private** (not public)
3. **Check storage policies**: Make sure the policies from `storage_bucket_setup.sql` were created
4. **Refresh the page**: Sometimes a page refresh helps after bucket creation

## Need Help?

If you continue to have issues, check:
- Supabase Storage documentation: https://supabase.com/docs/guides/storage
- Your Supabase project's Storage settings
- Browser console for additional error messages


