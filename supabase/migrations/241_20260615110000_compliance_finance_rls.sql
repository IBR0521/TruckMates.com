-- RLS policies for tables introduced in migration 240 (idempotent).

ALTER TABLE public.trip_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_sheet_state_miles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_verifications ENABLE ROW LEVEL SECURITY;

-- trip_sheets
DROP POLICY IF EXISTS "trip_sheets_select_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_select_company" ON public.trip_sheets
  FOR SELECT USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "trip_sheets_insert_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_insert_company" ON public.trip_sheets
  FOR INSERT WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "trip_sheets_update_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_update_company" ON public.trip_sheets
  FOR UPDATE
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "trip_sheets_delete_company" ON public.trip_sheets;
CREATE POLICY "trip_sheets_delete_company" ON public.trip_sheets
  FOR DELETE USING (company_id = (SELECT get_user_company_id()));

-- trip_sheet_state_miles (scoped via parent trip sheet)
DROP POLICY IF EXISTS "trip_sheet_state_miles_all" ON public.trip_sheet_state_miles;
CREATE POLICY "trip_sheet_state_miles_all" ON public.trip_sheet_state_miles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_sheets ts
      WHERE ts.id = trip_sheet_id
        AND ts.company_id = (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_sheets ts
      WHERE ts.id = trip_sheet_id
        AND ts.company_id = (SELECT get_user_company_id())
    )
  );

-- company_invoice_taxes
DROP POLICY IF EXISTS "Users can view invoice taxes from their company" ON public.company_invoice_taxes;
CREATE POLICY "Users can view invoice taxes from their company"
  ON public.company_invoice_taxes FOR SELECT
  USING (company_id = (SELECT get_user_company_id()));

DROP POLICY IF EXISTS "Managers can insert invoice taxes" ON public.company_invoice_taxes;
CREATE POLICY "Managers can insert invoice taxes"
  ON public.company_invoice_taxes FOR INSERT
  WITH CHECK (
    company_id = (SELECT get_user_company_id())
    AND (SELECT is_user_manager())
  );

DROP POLICY IF EXISTS "Managers can update invoice taxes" ON public.company_invoice_taxes;
CREATE POLICY "Managers can update invoice taxes"
  ON public.company_invoice_taxes FOR UPDATE
  USING (
    company_id = (SELECT get_user_company_id())
    AND (SELECT is_user_manager())
  )
  WITH CHECK (
    company_id = (SELECT get_user_company_id())
    AND (SELECT is_user_manager())
  );

DROP POLICY IF EXISTS "Managers can delete invoice taxes" ON public.company_invoice_taxes;
CREATE POLICY "Managers can delete invoice taxes"
  ON public.company_invoice_taxes FOR DELETE
  USING (
    company_id = (SELECT get_user_company_id())
    AND (SELECT is_user_manager())
  );

-- invoice_verifications
DROP POLICY IF EXISTS "Users can view invoice verifications in their company" ON public.invoice_verifications;
DROP POLICY IF EXISTS "Users can insert invoice verifications in their company" ON public.invoice_verifications;
DROP POLICY IF EXISTS "Users can update invoice verifications in their company" ON public.invoice_verifications;
DROP POLICY IF EXISTS "Users can manage invoice verifications in their company" ON public.invoice_verifications;

CREATE POLICY "Users can manage invoice verifications in their company"
  ON public.invoice_verifications FOR ALL
  USING (company_id = (SELECT get_user_company_id()))
  WITH CHECK (company_id = (SELECT get_user_company_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_sheet_state_miles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invoice_taxes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_verifications TO authenticated;
