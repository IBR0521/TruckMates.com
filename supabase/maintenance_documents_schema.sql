-- ============================================================================
-- Maintenance Document Storage
-- ============================================================================
-- Centralized digital documentation for all maintenance records
-- ============================================================================

-- Step 1: Add document storage to maintenance table
ALTER TABLE public.maintenance
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::JSONB; -- Array of { url, name, type, uploaded_at, uploaded_by }

-- Step 2: Create maintenance_documents table for better tracking
CREATE TABLE IF NOT EXISTS public.maintenance_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  maintenance_id UUID REFERENCES public.maintenance(id) ON DELETE CASCADE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE NOT NULL,
  
  -- Document Info
  document_type TEXT NOT NULL CHECK (document_type IN (
    'repair_order', 'invoice', 'warranty', 'part_receipt', 
    'inspection', 'estimate', 'work_order', 'photo', 'other'
  )),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Storage
  storage_url TEXT NOT NULL,
  file_size INTEGER, -- Size in bytes
  mime_type TEXT, -- e.g., 'application/pdf', 'image/jpeg'
  
  -- Metadata
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_documents_company_id ON public.maintenance_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_documents_maintenance_id ON public.maintenance_documents(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_documents_truck_id ON public.maintenance_documents(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_documents_type ON public.maintenance_documents(document_type);

-- Step 4: Function to sync document to maintenance.documents JSONB
CREATE OR REPLACE FUNCTION sync_document_to_maintenance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update maintenance.documents JSONB array
  UPDATE public.maintenance
  SET documents = COALESCE(documents, '[]'::JSONB) || jsonb_build_object(
    'id', NEW.id,
    'url', NEW.storage_url,
    'name', NEW.name,
    'type', NEW.document_type,
    'uploaded_at', NEW.uploaded_at,
    'uploaded_by', NEW.uploaded_by
  ),
  updated_at = NOW()
  WHERE id = NEW.maintenance_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Trigger to auto-sync documents
DROP TRIGGER IF EXISTS trigger_sync_document_to_maintenance ON public.maintenance_documents;
CREATE TRIGGER trigger_sync_document_to_maintenance
  AFTER INSERT ON public.maintenance_documents
  FOR EACH ROW
  EXECUTE FUNCTION sync_document_to_maintenance();

-- Step 6: Function to remove document from maintenance.documents when deleted
CREATE OR REPLACE FUNCTION remove_document_from_maintenance()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove document from maintenance.documents JSONB array
  UPDATE public.maintenance
  SET documents = documents - (SELECT ordinality - 1 FROM jsonb_array_elements(documents) WITH ORDINALITY WHERE (value->>'id')::UUID = OLD.id),
      updated_at = NOW()
  WHERE id = OLD.maintenance_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Trigger to remove document when deleted
DROP TRIGGER IF EXISTS trigger_remove_document_from_maintenance ON public.maintenance_documents;
CREATE TRIGGER trigger_remove_document_from_maintenance
  AFTER DELETE ON public.maintenance_documents
  FOR EACH ROW
  EXECUTE FUNCTION remove_document_from_maintenance();

-- Step 8: Enable RLS
ALTER TABLE public.maintenance_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view maintenance documents in their company" ON public.maintenance_documents;
CREATE POLICY "Users can view maintenance documents in their company"
  ON public.maintenance_documents FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert maintenance documents in their company" ON public.maintenance_documents;
CREATE POLICY "Users can insert maintenance documents in their company"
  ON public.maintenance_documents FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update maintenance documents in their company" ON public.maintenance_documents;
CREATE POLICY "Users can update maintenance documents in their company"
  ON public.maintenance_documents FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete maintenance documents in their company" ON public.maintenance_documents;
CREATE POLICY "Users can delete maintenance documents in their company"
  ON public.maintenance_documents FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Step 9: Add comments
COMMENT ON TABLE public.maintenance_documents IS 
  'Stores all documents related to maintenance records (repair orders, invoices, warranties, etc.)';
COMMENT ON COLUMN public.maintenance.documents IS 
  'JSONB array of document references for quick access from maintenance record';


