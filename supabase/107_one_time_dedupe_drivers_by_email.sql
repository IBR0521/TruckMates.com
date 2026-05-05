-- =============================================================================
-- ONE-TIME: Deduplicate drivers (same company + same email, case-insensitive)
-- Keeps one row per (company_id, email): prefers user_id set, then oldest, then id.
-- Repoints FKs, then deletes duplicate driver rows.
-- Does NOT touch rows with NULL/empty email.
-- Run in Supabase SQL Editor. Review counts first with the SELECT at bottom (optional).
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS _dedupe_dup;
CREATE TEMP TABLE _dedupe_dup (
  loser_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO _dedupe_dup (loser_id, canonical_id)
WITH canon AS (
  SELECT DISTINCT ON (company_id, lower(trim(email)))
    id AS canonical_id,
    company_id,
    lower(trim(email)) AS em
  FROM public.drivers
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY
    company_id,
    lower(trim(email)),
    (user_id IS NOT NULL) DESC,
    created_at ASC NULLS LAST,
    id ASC
)
SELECT d.id, c.canonical_id
FROM public.drivers d
JOIN canon c
  ON c.company_id = d.company_id
 AND lower(trim(d.email)) = c.em
WHERE d.id <> c.canonical_id;

-- Core ELD / fleet
UPDATE public.eld_logs l SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE l.driver_id = d.loser_id;
UPDATE public.eld_events e SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE e.driver_id = d.loser_id;
UPDATE public.eld_locations el SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE el.driver_id = d.loser_id;

UPDATE public.loads l SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE l.driver_id = d.loser_id;
UPDATE public.routes r SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE r.driver_id = d.loser_id;
UPDATE public.expenses e SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE e.driver_id = d.loser_id;
UPDATE public.documents doc SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE doc.driver_id = d.loser_id;
UPDATE public.settlements s SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE s.driver_id = d.loser_id;
UPDATE public.dvir v SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE v.driver_id = d.loser_id;
UPDATE public.trucks t SET current_driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.current_driver_id = d.loser_id;

-- eld_driver_mappings: remove loser rows that duplicate (device, provider) on canonical
DELETE FROM public.eld_driver_mappings m
USING _dedupe_dup dup, public.eld_driver_mappings mc
WHERE m.internal_driver_id = dup.loser_id
  AND mc.internal_driver_id = dup.canonical_id
  AND m.eld_device_id = mc.eld_device_id
  AND m.provider_driver_id = mc.provider_driver_id;

UPDATE public.eld_driver_mappings m
SET internal_driver_id = dup.canonical_id
FROM _dedupe_dup dup
WHERE m.internal_driver_id = dup.loser_id;

-- driver_onboarding: UNIQUE(driver_id) — drop loser onboarding if canonical already has one
DELETE FROM public.driver_onboarding ob
USING _dedupe_dup dup, public.driver_onboarding ob2
WHERE ob.driver_id = dup.loser_id
  AND ob2.driver_id = dup.canonical_id;

UPDATE public.driver_onboarding ob
SET driver_id = dup.canonical_id
FROM _dedupe_dup dup
WHERE ob.driver_id = dup.loser_id;

-- Extended tables (skipped if table/column missing: SQLSTATE 42P01 / 42703)
DO $opt$
BEGIN
  EXECUTE 'UPDATE public.trip_sheets t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.idle_time_sessions t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.state_crossings t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.driver_badges t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.driver_performance_scores t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.detention_tracking t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.zone_visits t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.chat_threads t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.alerts t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.reminders t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.check_calls t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.eta_updates t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.fuel_purchases t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.realtime_eta t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

DO $opt$
BEGIN
  EXECUTE 'UPDATE public.geofencing_events t SET driver_id = d.canonical_id FROM _dedupe_dup d WHERE t.driver_id = d.loser_id';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42P01', '42703') THEN NULL; ELSE RAISE; END IF;
END
$opt$;

-- Delete duplicate driver rows
DELETE FROM public.drivers drv
USING _dedupe_dup d
WHERE drv.id = d.loser_id;

COMMIT;

-- =============================================================================
-- Optional: preview how many rows would duplicate-merge (run separately, read-only)
-- =============================================================================
/*
WITH canon AS (
  SELECT DISTINCT ON (company_id, lower(trim(email)))
    id AS canonical_id,
    company_id,
    lower(trim(email)) AS em
  FROM public.drivers
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY
    company_id,
    lower(trim(email)),
    (user_id IS NOT NULL) DESC,
    created_at ASC NULLS LAST,
    id ASC
)
SELECT count(*) AS duplicate_rows_to_remove
FROM public.drivers d
JOIN canon c
  ON c.company_id = d.company_id
 AND lower(trim(d.email)) = c.em
WHERE d.id <> c.canonical_id;
*/
