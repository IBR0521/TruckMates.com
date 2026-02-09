-- Audit Logs Schema
-- Tracks all changes and actions for compliance and security auditing

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Action details
  action TEXT NOT NULL, -- e.g., "data.updated", "status_updated", "data.deleted"
  resource_type TEXT NOT NULL, -- e.g., "driver", "load", "truck"
  resource_id UUID, -- ID of the resource being acted upon
  
  -- Change details (JSONB for flexibility)
  details JSONB DEFAULT '{}'::jsonb, -- Contains field, old_value, new_value, reason, etc.
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view audit logs for their company" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs for their company" ON public.audit_logs;

-- SELECT Policy: Users can view audit logs for their company
CREATE POLICY "Users can view audit logs for their company"
  ON public.audit_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- INSERT Policy: Allow authenticated users to insert audit logs for their own company
CREATE POLICY "Users can insert audit logs for their company"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

