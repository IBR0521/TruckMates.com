-- Add unique constraint to prevent duplicate ELD logs
-- This prevents the same log from being inserted multiple times during sync

-- Step 1: Remove duplicate records before creating unique index
-- Keep the most recent record (highest id or created_at) for each duplicate group
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT eld_device_id, log_date, start_time, log_type
    FROM public.eld_logs
    WHERE start_time IS NOT NULL
    GROUP BY eld_device_id, log_date, start_time, log_type
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate groups. Removing duplicates...', duplicate_count;
    
    -- Delete duplicates, keeping the one with the highest id (most recent)
    DELETE FROM public.eld_logs
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY eld_device_id, log_date, start_time, log_type 
                 ORDER BY id DESC, created_at DESC
               ) as rn
        FROM public.eld_logs
        WHERE start_time IS NOT NULL
      ) ranked
      WHERE rn > 1
    );
    
    GET DIAGNOSTICS duplicate_count = ROW_COUNT;
    RAISE NOTICE 'Removed % duplicate records', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicates found.';
  END IF;
END $$;

-- Step 2: Create unique constraint on eld_logs to prevent duplicates
-- Based on: eld_device_id, log_date, start_time, log_type
-- This ensures the same log entry cannot be inserted twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_eld_logs_unique_log 
  ON public.eld_logs(eld_device_id, log_date, start_time, log_type)
  WHERE start_time IS NOT NULL;

COMMENT ON INDEX idx_eld_logs_unique_log IS 
  'Prevents duplicate ELD log entries for the same device, date, start time, and log type';

