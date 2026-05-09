-- Transactional RPCs for settlement, invoice creation, and load assignment.
-- Matches application column names (see app/actions/accounting.ts, dispatches.ts).

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loads_invoice_id ON public.loads (invoice_id) WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_settlement_transactional(
  p_company_id uuid,
  p_driver_id uuid,
  p_period_start date,
  p_period_end date,
  p_gross_pay numeric,
  p_fuel_deduction numeric,
  p_advance_deduction numeric,
  p_other_deductions numeric,
  p_total_deductions numeric,
  p_per_diem_eligible_nights integer,
  p_per_diem_rate_used numeric,
  p_per_diem_amount numeric,
  p_lease_deduction numeric,
  p_net_pay numeric,
  p_status text,
  p_payment_method text,
  p_gl_code text,
  p_loads jsonb,
  p_pay_rule_id uuid,
  p_calculation_details jsonb,
  p_lease_agreement_id uuid,
  p_lease_remaining_after numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settlement_id uuid;
  v_lease_payment_id uuid;
BEGIN
  INSERT INTO public.settlements (
    company_id,
    driver_id,
    period_start,
    period_end,
    gross_pay,
    fuel_deduction,
    advance_deduction,
    lease_deduction,
    other_deductions,
    total_deductions,
    per_diem_eligible_nights,
    per_diem_rate_used,
    per_diem_amount,
    net_pay,
    status,
    payment_method,
    gl_code,
    loads,
    pay_rule_id,
    calculation_details
  ) VALUES (
    p_company_id,
    p_driver_id,
    p_period_start,
    p_period_end,
    p_gross_pay,
    COALESCE(p_fuel_deduction, 0),
    COALESCE(p_advance_deduction, 0),
    COALESCE(p_lease_deduction, 0),
    COALESCE(p_other_deductions, 0),
    p_total_deductions,
    COALESCE(p_per_diem_eligible_nights, 0),
    COALESCE(p_per_diem_rate_used, 0),
    COALESCE(p_per_diem_amount, 0),
    p_net_pay,
    COALESCE(p_status, 'pending'),
    NULLIF(trim(COALESCE(p_payment_method, '')), ''),
    NULLIF(trim(COALESCE(p_gl_code, '')), ''),
    p_loads,
    p_pay_rule_id,
    p_calculation_details
  )
  RETURNING id INTO v_settlement_id;

  IF p_lease_agreement_id IS NOT NULL AND COALESCE(p_lease_deduction, 0) > 0 THEN
    INSERT INTO public.lease_payments (
      company_id,
      lease_agreement_id,
      settlement_id,
      amount,
      payment_date,
      remaining_balance_after
    ) VALUES (
      p_company_id,
      p_lease_agreement_id,
      v_settlement_id,
      p_lease_deduction,
      p_period_end,
      COALESCE(p_lease_remaining_after, 0)
    )
    RETURNING id INTO v_lease_payment_id;

    UPDATE public.lease_agreements
    SET
      remaining_balance = COALESCE(p_lease_remaining_after, 0),
      is_active = CASE
        WHEN COALESCE(p_lease_remaining_after, 0) <= 0 THEN false
        ELSE is_active
      END,
      updated_at = now()
    WHERE id = p_lease_agreement_id
      AND company_id = p_company_id;
  END IF;

  RETURN json_build_object(
    'settlement_id', v_settlement_id,
    'lease_payment_id', v_lease_payment_id,
    'remaining_balance', p_lease_remaining_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_settlement_transactional failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_transactional(
  p_company_id uuid,
  p_load_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_subtotal numeric,
  p_fuel_surcharge numeric,
  p_accessorials numeric,
  p_tax_amount numeric,
  p_total_amount numeric,
  p_status text,
  p_line_items jsonb,
  p_customer_name text,
  p_payment_terms text,
  p_description text,
  p_tax_rate numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_items jsonb;
BEGIN
  v_items := COALESCE(p_line_items, '[]'::jsonb);
  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
    v_items := '[]'::jsonb;
  END IF;

  INSERT INTO public.invoices (
    company_id,
    invoice_number,
    customer_name,
    load_id,
    amount,
    status,
    issue_date,
    due_date,
    payment_terms,
    description,
    items,
    tax_amount,
    tax_rate,
    subtotal
  ) VALUES (
    p_company_id,
    p_invoice_number,
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Customer'),
    p_load_id,
    p_total_amount,
    COALESCE(p_status, 'pending'),
    p_invoice_date,
    p_due_date,
    p_payment_terms,
    p_description,
    v_items,
    NULLIF(p_tax_amount, 0),
    NULLIF(p_tax_rate, 0),
    NULLIF(p_subtotal, 0)
  )
  RETURNING id INTO v_invoice_id;

  IF p_load_id IS NOT NULL THEN
    UPDATE public.loads
    SET
      invoice_id = v_invoice_id,
      updated_at = now()
    WHERE id = p_load_id
      AND company_id = p_company_id;
  END IF;

  RETURN json_build_object('invoice_id', v_invoice_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_invoice_transactional failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_load_transactional(
  p_load_id uuid,
  p_company_id uuid,
  p_truck_id uuid,
  p_trailer_id uuid,
  p_driver_id uuid,
  p_assigned_by uuid,
  p_update_driver boolean,
  p_update_truck boolean,
  p_update_trailer boolean,
  p_set_status boolean,
  p_new_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_load_company uuid;
  v_existing_status text;
BEGIN
  SELECT company_id, status
  INTO v_load_company, v_existing_status
  FROM public.loads
  WHERE id = p_load_id;

  IF v_load_company IS NULL THEN
    RAISE EXCEPTION 'Load not found';
  END IF;

  IF v_load_company <> p_company_id THEN
    RAISE EXCEPTION 'Load does not belong to this company';
  END IF;

  UPDATE public.loads
  SET
    truck_id = CASE WHEN p_update_truck THEN p_truck_id ELSE truck_id END,
    trailer_id = CASE WHEN p_update_trailer THEN p_trailer_id ELSE trailer_id END,
    driver_id = CASE WHEN p_update_driver THEN p_driver_id ELSE driver_id END,
    status = CASE WHEN p_set_status THEN COALESCE(p_new_status, status) ELSE status END,
    updated_at = now()
  WHERE id = p_load_id
    AND company_id = p_company_id;

  INSERT INTO public.audit_logs (
    company_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    created_at
  ) VALUES (
    p_company_id,
    p_assigned_by,
    'load_assigned',
    'load',
    p_load_id,
    jsonb_build_object(
      'truck_id', p_truck_id,
      'trailer_id', p_trailer_id,
      'driver_id', p_driver_id,
      'previous_status', v_existing_status,
      'update_driver', p_update_driver,
      'update_truck', p_update_truck,
      'update_trailer', p_update_trailer,
      'set_status', p_set_status,
      'new_status', p_new_status
    ),
    now()
  );

  RETURN json_build_object(
    'load_id', p_load_id,
    'status', 'assigned'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'assign_load_transactional failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_settlement_transactional TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_transactional TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_load_transactional TO authenticated, service_role;
