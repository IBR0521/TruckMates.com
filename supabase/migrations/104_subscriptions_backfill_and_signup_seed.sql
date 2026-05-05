-- Seed subscriptions row on new companies + backfill existing companies on free plan.
-- Run in Supabase SQL Editor (or via migration runner) after:
--   - public.companies, public.users, subscription_plans, subscriptions exist
--   - subscription_plans has a 'free' row (see subscriptions_schema.sql)

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
  INSERT INTO public.companies (name, email, phone, company_type)
  VALUES (p_name, p_email, p_phone, p_company_type)
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

-- Backfill: one active free subscription per company that has none
INSERT INTO public.subscriptions (company_id, plan_id, status)
SELECT c.id, sp.id, 'active'
FROM public.companies c
CROSS JOIN LATERAL (
  SELECT id FROM public.subscription_plans WHERE name = 'free' AND is_active IS NOT FALSE LIMIT 1
) sp
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.company_id = c.id
);
