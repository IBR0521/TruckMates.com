-- QUICK SETUP: Copy and paste this into Supabase SQL Editor
-- This creates the 'documents' storage bucket

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- After running the above, run the full setup from: supabase/storage_bucket_setup.sql
-- That will add all the necessary storage policies.

