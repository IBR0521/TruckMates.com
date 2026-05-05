-- ============================================================================
-- Fix user deletion failures from auth.users
-- ============================================================================
-- Why this exists:
-- Some foreign keys that reference auth.users/public.users were created with
-- default NO ACTION/RESTRICT behavior. Deleting a user in Supabase Auth then
-- fails because dependent rows block the delete.
--
-- What this migration does:
-- 1) Ensures public.users(id) -> auth.users(id) uses ON DELETE CASCADE
-- 2) Rewrites other public-schema FKs referencing auth.users/public.users:
--    - ON DELETE SET NULL if all FK columns are nullable
--    - ON DELETE CASCADE if any FK column is NOT NULL
-- ============================================================================

BEGIN;

DO $$
DECLARE
  fk RECORD;
  fk_cols TEXT;
  ref_cols TEXT;
  match_clause TEXT;
  update_clause TEXT;
  delete_clause TEXT;
  defer_clause TEXT;
BEGIN
  FOR fk IN
    SELECT
      c.oid,
      c.conname,
      c.conrelid,
      c.confrelid,
      c.conkey,
      c.confkey,
      c.confmatchtype,
      c.confupdtype,
      c.confdeltype,
      c.condeferrable,
      c.condeferred,
      n.nspname AS table_schema,
      cls.relname AS table_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND (
        c.confrelid = 'auth.users'::regclass
        OR c.confrelid = 'public.users'::regclass
      )
  LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY k.ord)
      INTO fk_cols
    FROM unnest(fk.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = k.attnum;

    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY k.ord)
      INTO ref_cols
    FROM unnest(fk.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = fk.confrelid AND a.attnum = k.attnum;

    match_clause := CASE fk.confmatchtype
      WHEN 'f' THEN 'MATCH FULL '
      WHEN 'p' THEN 'MATCH PARTIAL '
      ELSE ''
    END;

    update_clause := CASE fk.confupdtype
      WHEN 'c' THEN 'ON UPDATE CASCADE '
      WHEN 'n' THEN 'ON UPDATE SET NULL '
      WHEN 'd' THEN 'ON UPDATE SET DEFAULT '
      WHEN 'r' THEN 'ON UPDATE RESTRICT '
      ELSE 'ON UPDATE NO ACTION '
    END;

    defer_clause := CASE
      WHEN fk.condeferrable AND fk.condeferred THEN 'DEFERRABLE INITIALLY DEFERRED'
      WHEN fk.condeferrable THEN 'DEFERRABLE INITIALLY IMMEDIATE'
      ELSE 'NOT DEFERRABLE'
    END;

    -- Force public.users -> auth.users to cascade for account deletion hygiene.
    IF fk.conrelid = 'public.users'::regclass
       AND fk.confrelid = 'auth.users'::regclass THEN
      delete_clause := 'ON DELETE CASCADE ';
    ELSE
      -- For other references:
      -- nullable FK columns => SET NULL, otherwise CASCADE.
      IF EXISTS (
        SELECT 1
        FROM unnest(fk.conkey) AS k(attnum)
        JOIN pg_attribute a
          ON a.attrelid = fk.conrelid
         AND a.attnum = k.attnum
        WHERE a.attnotnull
      ) THEN
        delete_clause := 'ON DELETE CASCADE ';
      ELSE
        delete_clause := 'ON DELETE SET NULL ';
      END IF;
    END IF;

    -- Only rewrite when currently NO ACTION/RESTRICT or wrong action on users->auth.
    IF fk.confdeltype IN ('a', 'r')
       OR (
         fk.conrelid = 'public.users'::regclass
         AND fk.confrelid = 'auth.users'::regclass
         AND fk.confdeltype <> 'c'
       ) THEN
      EXECUTE format(
        'ALTER TABLE %s DROP CONSTRAINT %I',
        fk.conrelid::regclass,
        fk.conname
      );

      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s (%s) %s%s%s%s',
        fk.conrelid::regclass,
        fk.conname,
        fk_cols,
        fk.confrelid::regclass,
        ref_cols,
        match_clause,
        update_clause,
        delete_clause,
        defer_clause
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
