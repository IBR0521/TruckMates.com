# 🚨 URGENT: Create Storage Bucket

## Your Error:
**"Storage bucket 'documents' NOT FOUND"** - Available buckets: **none**

This means the bucket doesn't exist in your Supabase project.

---

## ✅ SOLUTION (Copy & Paste)

### Step 1: Open Supabase
1. Go to: **https://supabase.com/dashboard**
2. Sign in
3. Click on your project: **arzecjrilongtnlzmaty** (or the one matching your URL)

### Step 2: Open SQL Editor
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button

### Step 3: Copy & Paste This SQL

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies
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

### Step 4: Run It
- Click **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)
- You should see "Success" messages

### Step 5: Verify
1. Click **"Storage"** in the left sidebar
2. You should see a bucket named **"documents"**
3. If you DON'T see it → You're in the wrong Supabase project!

### Step 6: Test
1. Refresh your browser
2. Try uploading a document again

---

## ❓ Still Not Working?

### Check 1: Right Project?
- Your app uses: `https://arzecjrilongtnlzmaty.supabase.co`
- Make sure you're in THAT project in Supabase dashboard
- Check the project URL matches

### Check 2: SQL Ran Successfully?
- Look for any error messages in SQL Editor
- All statements should show "Success"

### Check 3: Bucket Visible?
- Go to Storage → You should see "documents" bucket
- If not visible, refresh the page

### Check 4: Try Verification SQL
Run this to check if bucket exists:
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'documents';
```
- If you see a row → Bucket exists ✅
- If no rows → Bucket doesn't exist ❌ (run Step 3 again)

---

## 📝 Files in Your Project:
- `CREATE_BUCKET.sql` - Complete SQL file
- `supabase/storage_bucket_setup.sql` - Full setup with comments
- `BUCKET_SETUP_STEPS.md` - This file

---

**The bucket MUST be created manually in Supabase - the app cannot create it automatically.**





