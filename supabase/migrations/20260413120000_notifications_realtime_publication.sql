-- Realtime (postgres_changes) for public.notifications:
-- 1) REPLICA IDENTITY FULL — required so UPDATE/DELETE payloads include row data the client expects.
-- 2) Add table to supabase_realtime publication — without this, inserts never broadcast to subscribers.

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$pub$;

COMMENT ON TABLE public.notifications IS
  'In-app notifications; listed in supabase_realtime with REPLICA IDENTITY FULL for Supabase Realtime postgres_changes.';
