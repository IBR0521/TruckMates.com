# 🚨 URGENT: Create Storage Bucket

You're getting this error because the `documents` bucket doesn't exist in your Supabase project.

## ⚡ QUICK FIX (2 Minutes)

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project

### Step 2: Run This SQL
1. Click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. **Copy and paste this EXACT SQL:**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
```

4. Click **"Run"** (or press `Cmd+Enter` / `Ctrl+Enter`)

### Step 3: Verify It Worked
1. Click **"Storage"** (left sidebar)
2. You should see a bucket named **"documents"**
3. If you see it → ✅ Success! Go to Step 4
4. If you DON'T see it → You're in the wrong Supabase project

### Step 4: Set Up Policies
Run this SQL (same SQL Editor):

```sql
DROP POLICY IF EXISTS "Users can upload documents to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view company documents" ON storage.objects;

CREATE POLICY "Users can upload documents to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Managers can view company documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.users u ON d.company_id = u.company_id
    WHERE u.id = auth.uid() AND u.role = 'manager'
    AND d.file_url LIKE '%' || storage.objects.name || '%'
  )
);
```

### Step 5: Test
1. Refresh your browser
2. Try uploading a document again
3. The error should be gone! ✅

---

## ❓ Still Not Working?

### Check 1: Right Supabase Project?
- Open your `.env.local` file
- Check `NEXT_PUBLIC_SUPABASE_URL`
- Make sure you created the bucket in THAT project

### Check 2: Bucket Name Exact?
- Must be exactly: `documents` (lowercase, no spaces)
- Not: `Documents`, `document`, `DOCUMENTS`

### Check 3: Bucket is Private?
- In Supabase Storage, the bucket should show as **Private** (not Public)

### Check 4: Run Verification SQL
Run this to check if bucket exists:

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'documents';
```

If you see a row → bucket exists ✅
If no rows → bucket doesn't exist ❌ (run Step 2 again)

---

## 📝 Files in Your Project
- `CREATE_BUCKET_NOW.sql` - Complete SQL file
- `supabase/storage_bucket_setup.sql` - Full setup with comments
- `supabase/verify_bucket.sql` - Verification SQL




