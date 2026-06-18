-- Enable RLS on tenant tables flagged by the security linter (pattern: migration 241).

ALTER TABLE public.edi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edi_load_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_payments ENABLE ROW LEVEL SECURITY;

-- edi_messages
DROP POLICY IF EXISTS "edi_messages_select_company" ON public.edi_messages;
CREATE POLICY "edi_messages_select_company" ON public.edi_messages
  FOR SELECT USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "edi_messages_insert_company" ON public.edi_messages;
CREATE POLICY "edi_messages_insert_company" ON public.edi_messages
  FOR INSERT WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "edi_messages_update_company" ON public.edi_messages;
CREATE POLICY "edi_messages_update_company" ON public.edi_messages
  FOR UPDATE
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "edi_messages_delete_company" ON public.edi_messages;
CREATE POLICY "edi_messages_delete_company" ON public.edi_messages
  FOR DELETE USING (company_id = (SELECT get_user_company_id()));

-- permits
DROP POLICY IF EXISTS "permits_select_company" ON public.permits;
CREATE POLICY "permits_select_company" ON public.permits
  FOR SELECT USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "permits_insert_company" ON public.permits;
CREATE POLICY "permits_insert_company" ON public.permits
  FOR INSERT WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "permits_update_company" ON public.permits;
CREATE POLICY "permits_update_company" ON public.permits
  FOR UPDATE
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "permits_delete_company" ON public.permits;
CREATE POLICY "permits_delete_company" ON public.permits
  FOR DELETE USING (company_id = (SELECT get_user_company_id()));

-- edi_load_tenders
DROP POLICY IF EXISTS "edi_load_tenders_select_company" ON public.edi_load_tenders;
CREATE POLICY "edi_load_tenders_select_company" ON public.edi_load_tenders
  FOR SELECT USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "edi_load_tenders_insert_company" ON public.edi_load_tenders;
CREATE POLICY "edi_load_tenders_insert_company" ON public.edi_load_tenders
  FOR INSERT WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "edi_load_tenders_update_company" ON public.edi_load_tenders;
CREATE POLICY "edi_load_tenders_update_company" ON public.edi_load_tenders
  FOR UPDATE
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "edi_load_tenders_delete_company" ON public.edi_load_tenders;
CREATE POLICY "edi_load_tenders_delete_company" ON public.edi_load_tenders
  FOR DELETE USING (company_id = (SELECT get_user_company_id()));

-- lease_agreements
DROP POLICY IF EXISTS "lease_agreements_select_company" ON public.lease_agreements;
CREATE POLICY "lease_agreements_select_company" ON public.lease_agreements
  FOR SELECT USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "lease_agreements_insert_company" ON public.lease_agreements;
CREATE POLICY "lease_agreements_insert_company" ON public.lease_agreements
  FOR INSERT WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "lease_agreements_update_company" ON public.lease_agreements;
CREATE POLICY "lease_agreements_update_company" ON public.lease_agreements
  FOR UPDATE
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "lease_agreements_delete_company" ON public.lease_agreements;
CREATE POLICY "lease_agreements_delete_company" ON public.lease_agreements
  FOR DELETE USING (company_id = (SELECT get_user_company_id()));

-- lease_payments
DROP POLICY IF EXISTS "lease_payments_select_company" ON public.lease_payments;
CREATE POLICY "lease_payments_select_company" ON public.lease_payments
  FOR SELECT USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "lease_payments_insert_company" ON public.lease_payments;
CREATE POLICY "lease_payments_insert_company" ON public.lease_payments
  FOR INSERT WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "lease_payments_update_company" ON public.lease_payments;
CREATE POLICY "lease_payments_update_company" ON public.lease_payments
  FOR UPDATE
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "lease_payments_delete_company" ON public.lease_payments;
CREATE POLICY "lease_payments_delete_company" ON public.lease_payments
  FOR DELETE USING (company_id = (SELECT get_user_company_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edi_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edi_load_tenders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lease_agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lease_payments TO authenticated;

-- PostGIS reference data: owned by the extension — cannot ENABLE ROW LEVEL SECURITY on Supabase
-- (ERROR 42501: must be owner of table spatial_ref_sys). Restrict API access instead:
-- block anon, allow authenticated read-only (equivalent intent to a SELECT-only RLS policy).
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM PUBLIC;
GRANT SELECT ON TABLE public.spatial_ref_sys TO authenticated;
GRANT SELECT ON TABLE public.spatial_ref_sys TO service_role;
