-- Lock down legacy pgcrypto ELD credential functions (superseded by application-level
-- encryption in lib/crypto/eld-credentials.ts). Do not drop yet — may exist on older DBs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'encrypt_eld_api_key'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.encrypt_eld_api_key(TEXT) FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'decrypt_eld_api_key'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.decrypt_eld_api_key(BYTEA) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

COMMENT ON FUNCTION public.encrypt_eld_api_key IS
  'DEPRECATED: superseded by app-level AES-256-GCM in lib/crypto/eld-credentials.ts. EXECUTE revoked from anon/authenticated.';
COMMENT ON FUNCTION public.decrypt_eld_api_key IS
  'DEPRECATED: superseded by app-level AES-256-GCM in lib/crypto/eld-credentials.ts. EXECUTE revoked from anon/authenticated.';
