-- Supabase database linter remediations (security):
-- 0011 function_search_path_mutable — set immutable search_path on flagged functions.
-- 0024 rls_policy_always_true — remove permissive INSERT policy; app inserts use service role (bypasses RLS).
--
-- Remaining WARNs (fix in Dashboard / ops, not this file):
-- 0014 extension_in_public (postgis, vector) — moving extensions is a larger migration.
-- auth_leaked_password_protection — enable in Supabase Auth settings.

-- ---------------------------------------------------------------------------
-- 1) Functions: SET search_path (lint 0011)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE id = notification_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE user_id = auth.uid() AND read = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) RLS: no INSERT policy for JWT roles — inserts use service role only (lint 0024)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert notifications for users" ON public.notifications;
