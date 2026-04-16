-- Ensure paid plans cannot be configured without Stripe price IDs.
-- NOT VALID avoids failing immediately on legacy rows while enforcing future writes.

ALTER TABLE public.subscription_plans
DROP CONSTRAINT IF EXISTS subscription_plans_paid_require_stripe_prices;

ALTER TABLE public.subscription_plans
ADD CONSTRAINT subscription_plans_paid_require_stripe_prices
CHECK (
  name NOT IN ('starter', 'professional', 'enterprise')
  OR (
    stripe_price_id_monthly IS NOT NULL
    AND length(trim(stripe_price_id_monthly)) > 0
    AND stripe_price_id_yearly IS NOT NULL
    AND length(trim(stripe_price_id_yearly)) > 0
  )
) NOT VALID;
