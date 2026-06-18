-- TOTP two-factor authentication (per-user secrets + short-lived login challenges).

CREATE TABLE IF NOT EXISTS public.user_totp_secrets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  verified_at TIMESTAMPTZ
);

COMMENT ON TABLE public.user_totp_secrets IS
  'Per-user TOTP secrets (AES-GCM via app encryptCredential). verified_at NULL = setup pending confirmation.';

CREATE TABLE IF NOT EXISTS public.pending_totp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_pending_totp_sessions_user_expires
  ON public.pending_totp_sessions(user_id, expires_at DESC);

COMMENT ON TABLE public.pending_totp_sessions IS
  'Short-lived (5 min) post-password login step before session is issued when TOTP is enabled.';

ALTER TABLE public.user_totp_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_totp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_totp_secrets_own" ON public.user_totp_secrets;
CREATE POLICY "user_totp_secrets_own" ON public.user_totp_secrets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pending challenges are server-managed only (no direct JWT access).
DROP POLICY IF EXISTS "pending_totp_sessions_deny" ON public.pending_totp_sessions;
CREATE POLICY "pending_totp_sessions_deny" ON public.pending_totp_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_totp_secrets TO authenticated;
GRANT ALL ON public.pending_totp_sessions TO service_role;
