-- Migration: Encrypt API keys and secrets in eld_devices table
-- SECURITY: This migration encrypts existing plaintext API keys/secrets using pgcrypto
-- 
-- IMPORTANT: 
-- 1. Set ENCRYPTION_KEY environment variable in Supabase before running
-- 2. This migration requires pgcrypto extension
-- 3. After migration, update application code to encrypt/decrypt on read/write

-- Step 1: Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Add encrypted columns (keeping old columns for migration)
DO $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from environment (set in Supabase Dashboard -> Settings -> Database)
  -- For now, we'll use a placeholder - REPLACE WITH ACTUAL KEY FROM ENV
  encryption_key := current_setting('app.encryption_key', true);
  
  -- If no key set, use a default (NOT SECURE - MUST BE CHANGED)
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE WARNING 'Encryption key not set. Using placeholder key. THIS IS NOT SECURE!';
    encryption_key := 'CHANGE_THIS_TO_ENV_VAR'; -- MUST BE REPLACED
  END IF;

  -- Add encrypted columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'eld_devices' 
    AND column_name = 'api_key_encrypted'
  ) THEN
    ALTER TABLE public.eld_devices 
      ADD COLUMN api_key_encrypted BYTEA,
      ADD COLUMN api_secret_encrypted BYTEA;
    
    COMMENT ON COLUMN public.eld_devices.api_key_encrypted IS 
      'Encrypted API key using pgcrypto (replaces api_key)';
    COMMENT ON COLUMN public.eld_devices.api_secret_encrypted IS 
      'Encrypted API secret using pgcrypto (replaces api_secret)';
  END IF;
END $$;

-- Step 3: Create function to encrypt API keys (for application use)
CREATE OR REPLACE FUNCTION encrypt_eld_api_key(plaintext_key TEXT)
RETURNS BYTEA AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := current_setting('app.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;
  
  RETURN pgp_sym_encrypt(plaintext_key, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to decrypt API keys (for application use)
CREATE OR REPLACE FUNCTION decrypt_eld_api_key(encrypted_key BYTEA)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := current_setting('app.encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_key, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Migration script to encrypt existing data
-- WARNING: This will encrypt existing plaintext keys
-- Run this manually after setting encryption key:
/*
DO $$
DECLARE
  encryption_key TEXT;
  device_record RECORD;
BEGIN
  encryption_key := current_setting('app.encryption_key', true);
  
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key must be set before running migration';
  END IF;
  
  -- Encrypt existing API keys
  FOR device_record IN 
    SELECT id, api_key, api_secret 
    FROM public.eld_devices 
    WHERE (api_key IS NOT NULL OR api_secret IS NOT NULL)
      AND (api_key_encrypted IS NULL OR api_secret_encrypted IS NULL)
  LOOP
    UPDATE public.eld_devices
    SET 
      api_key_encrypted = CASE 
        WHEN device_record.api_key IS NOT NULL 
        THEN pgp_sym_encrypt(device_record.api_key, encryption_key)
        ELSE NULL
      END,
      api_secret_encrypted = CASE 
        WHEN device_record.api_secret IS NOT NULL 
        THEN pgp_sym_encrypt(device_record.api_secret, encryption_key)
        ELSE NULL
      END
    WHERE id = device_record.id;
  END LOOP;
END $$;
*/

-- Step 6: After migration completes and application code is updated:
-- 1. Drop old plaintext columns (api_key, api_secret)
-- 2. Rename encrypted columns (api_key_encrypted -> api_key, api_secret_encrypted -> api_secret)
-- 
-- DO NOT RUN THIS UNTIL APPLICATION CODE IS UPDATED:
/*
ALTER TABLE public.eld_devices 
  DROP COLUMN IF EXISTS api_key,
  DROP COLUMN IF EXISTS api_secret;

ALTER TABLE public.eld_devices 
  RENAME COLUMN api_key_encrypted TO api_key;
ALTER TABLE public.eld_devices 
  RENAME COLUMN api_secret_encrypted TO api_secret;
*/

COMMENT ON FUNCTION encrypt_eld_api_key IS 
  'Encrypts API key for storage in eld_devices table. Requires app.encryption_key to be set.';
COMMENT ON FUNCTION decrypt_eld_api_key IS 
  'Decrypts API key from eld_devices table. Requires app.encryption_key to be set.';

