-- Storage Bucket Setup for Documents
-- Run this in Supabase SQL Editor to set up the documents storage bucket with proper policies

-- 1. Create the documents storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for the documents bucket
-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can upload documents to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view company documents" ON storage.objects;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload documents to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view/download their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow managers to view all documents in their company
-- Note: This requires checking the company_id from the documents table
-- For now, we'll allow managers to view documents if they can access the documents table
CREATE POLICY "Managers can view company documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.users u ON d.company_id = u.company_id
    WHERE u.id = auth.uid()
    AND u.role = 'manager'
    AND d.file_url LIKE '%' || storage.objects.name || '%'
  )
);

