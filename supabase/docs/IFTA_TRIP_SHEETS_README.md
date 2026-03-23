# IFTA manual trip sheets (no ELD)

Run these **in order** on your Supabase project so `/dashboard/ifta/trip-sheet` and merged IFTA generation work:

1. **`trip_sheets_schema.sql`** — Creates `trip_sheets`, `trip_sheet_state_miles`, `trip_sheet_fuel_purchases` + RLS.
2. **`ifta_reports_data_sources.sql`** — Adds `ifta_reports.ifta_data_sources` (JSONB) for auditor-facing GPS vs trip-sheet metadata.

After migration, regenerate IFTA reports to populate `ifta_data_sources` and combined state mileage.
