-- Optional metadata: how IFTA report mileage was sourced (GPS vs manual trip sheets)
ALTER TABLE public.ifta_reports
  ADD COLUMN IF NOT EXISTS ifta_data_sources JSONB;

COMMENT ON COLUMN public.ifta_reports.ifta_data_sources IS
  'JSON: { uses_gps, uses_trip_sheets, per_state_sources: { "TX": "gps"|"trip_sheet"|"both" } }';
