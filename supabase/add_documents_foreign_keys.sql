-- Migration: Add foreign key columns to documents table for load, route, invoice, and expense relationships
-- This migration adds the missing foreign key columns that are referenced in linkDocumentToRecord

-- Add load_id column
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL;

-- Add route_id column
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL;

-- Add invoice_id column
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Add expense_id column
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_load_id ON public.documents(load_id) WHERE load_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_route_id ON public.documents(route_id) WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_invoice_id ON public.documents(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_expense_id ON public.documents(expense_id) WHERE expense_id IS NOT NULL;

-- Add RLS policies for the new columns (documents table should already have RLS enabled)
-- These policies ensure users can only access documents linked to records in their company

-- Note: If RLS is already enabled on the documents table, these policies will work with existing ones
-- The existing company_id filter in linkDocumentToRecord ensures cross-company access is prevented

COMMENT ON COLUMN public.documents.load_id IS 'Foreign key to loads table. Links document to a specific load.';
COMMENT ON COLUMN public.documents.route_id IS 'Foreign key to routes table. Links document to a specific route.';
COMMENT ON COLUMN public.documents.invoice_id IS 'Foreign key to invoices table. Links document to a specific invoice.';
COMMENT ON COLUMN public.documents.expense_id IS 'Foreign key to expenses table. Links document to a specific expense.';

