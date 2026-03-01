# Fix Driver Leaderboard Bug

## Issue
Error: "Could not find the table 'public.driver_performance_scores' in the schema cache"

## Cause
The `driver_performance_scores` table hasn't been created in your Supabase database yet. The SQL migration file exists but hasn't been executed.

## Fix
Run this SQL in your Supabase SQL Editor:

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase/create_driver_performance_tables.sql`
4. Click "Run"

This will create:
- `driver_badges` table
- `driver_performance_scores` table
- Required indexes
- Row Level Security (RLS) policies

After running this, the Driver Leaderboard page should work correctly.

## Alternative
You can also run the full gamification SQL file `supabase/gamification.sql` which includes additional functions for calculating performance scores.







