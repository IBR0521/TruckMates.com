-- New companies: 14-day trial on Starter tier (explicit trial end timestamp).

CREATE OR REPLACE FUNCTION public.create_company_for_user(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_user_id UUID,
  p_company_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_free_plan_id UUID;
BEGIN
  INSERT INTO public.companies (
    name,
    email,
    phone,
    company_type,
    subscription_tier,
    subscription_status,
    trial_ends_at
  )
  VALUES (
    p_name,
    p_email,
    p_phone,
    p_company_type,
    'starter',
    'trial',
    timezone('utc', now()) + interval '14 days'
  )
  RETURNING id INTO v_company_id;

  UPDATE public.users
  SET
    company_id = v_company_id,
    role = 'super_admin',
    full_name = p_name,
    phone = p_phone
  WHERE id = p_user_id;

  IF to_regclass('public.subscription_plans') IS NOT NULL
     AND to_regclass('public.subscriptions') IS NOT NULL THEN
    SELECT id INTO v_free_plan_id
    FROM public.subscription_plans
    WHERE name = 'free' AND is_active IS NOT FALSE
    LIMIT 1;

    IF v_free_plan_id IS NOT NULL THEN
      INSERT INTO public.subscriptions (company_id, plan_id, status)
      VALUES (v_company_id, v_free_plan_id, 'active')
      ON CONFLICT (company_id) DO NOTHING;
    END IF;
  END IF;

  RETURN v_company_id::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_for_user(TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
