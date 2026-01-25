-- Verify Storage Bucket Setup
-- Run this in Supabase SQL Editor to check if the 'documents' bucket exists

-- Check if the bucket exists
SELECT 
  id, 
  name, 
  public,
  created_at,
  updated_at
FROM storage.buckets
WHERE id = 'documents';

-- If the above returns no rows, the bucket doesn't exist
-- If it returns a row, the bucket exists and you can see its configuration

-- Check storage policies for the documents bucket
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%documents%';

