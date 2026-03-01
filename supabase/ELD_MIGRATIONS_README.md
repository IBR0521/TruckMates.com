# ELD Module Database Migrations

This document lists all required database migrations for the ELD module fixes.

## Required Migrations

### 1. ✅ Unique Constraint for ELD Logs
**File:** `eld_logs_unique_constraint.sql`
**Purpose:** Prevents duplicate ELD log entries during sync
**Status:** Ready to run
**Impact:** Low - adds unique index, no data changes

```sql
-- Run this migration
\i supabase/eld_logs_unique_constraint.sql
```

### 2. ⚠️ Speed/Heading Decimal Precision
**File:** `eld_locations_speed_heading_decimal.sql`
**Purpose:** Changes speed and heading from INTEGER to DECIMAL to preserve precision
**Status:** Ready to run (only if table already exists with INTEGER columns)
**Impact:** Medium - alters column types, may require data conversion

```sql
-- Run this migration if eld_locations table already exists
\i supabase/eld_locations_speed_heading_decimal.sql
```

**Note:** If creating the table fresh, the schema already has DECIMAL types, so this migration is not needed.

### 3. 🔒 API Key Encryption (SECURITY)
**File:** `eld_api_keys_encryption.sql`
**Purpose:** Encrypts API keys and secrets at rest using pgcrypto
**Status:** Requires setup - needs encryption key configuration
**Impact:** High - requires application code changes

**Prerequisites:**
1. Set `app.encryption_key` in Supabase database settings
2. Update application code to use encrypt/decrypt functions
3. Migrate existing plaintext keys

**Steps:**
1. Set encryption key in Supabase Dashboard → Settings → Database → Custom Config
   ```sql
   ALTER DATABASE postgres SET app.encryption_key = 'your-secure-key-here';
   ```
2. Run migration to add encrypted columns
3. Update application code in `app/actions/eld.ts` and `app/actions/eld-sync.ts` to:
   - Encrypt keys when storing: `SELECT encrypt_eld_api_key('plaintext_key')`
   - Decrypt keys when reading: `SELECT decrypt_eld_api_key(api_key_encrypted)`
4. Run the data migration script (commented in the file) to encrypt existing keys
5. After verification, drop old columns and rename new ones

**Security Note:** The encryption key must be stored securely and never committed to git.

## Migration Order

1. **First:** Run `eld_logs_unique_constraint.sql` (safe, no data changes)
2. **Second:** Run `eld_locations_speed_heading_decimal.sql` (if table exists)
3. **Third:** Set up and run `eld_api_keys_encryption.sql` (requires code changes)

## Verification

After running migrations, verify:

```sql
-- Check unique constraint exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'eld_logs' 
AND indexname = 'idx_eld_logs_unique_log';

-- Check speed/heading are DECIMAL
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'eld_locations'
AND column_name IN ('speed', 'heading');

-- Check encrypted columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'eld_devices'
AND column_name IN ('api_key_encrypted', 'api_secret_encrypted');
```

## Rollback

If you need to rollback:

1. **Unique Constraint:** `DROP INDEX IF EXISTS idx_eld_logs_unique_log;`
2. **Speed/Heading:** Revert to INTEGER (data loss may occur)
3. **API Encryption:** Keep old columns until migration is complete, then drop encrypted columns

