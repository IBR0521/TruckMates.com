# Marketplace Setup Instructions

## Error: "Could not find the table 'public.load_marketplace' in the schema cache"

This error occurs because the `load_marketplace` table hasn't been created in your Supabase database yet.

## Quick Fix

1. **Go to Supabase Dashboard**
   - Navigate to your Supabase project
   - Click on "SQL Editor" in the left sidebar

2. **Run the Marketplace Schema**
   - Open the file: `supabase/marketplace_schema.sql`
   - Copy the entire contents
   - Paste it into the SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

3. **Verify the Table was Created**
   - Go to "Table Editor" in Supabase
   - You should see `load_marketplace` in the list of tables
   - You should also see `marketplace_subscriptions` and `marketplace_load_views`

## What This Creates

The schema creates three tables:

1. **`load_marketplace`** - Stores loads posted by brokers
2. **`marketplace_subscriptions`** - Carriers can subscribe to auto-receive matching loads
3. **`marketplace_load_views`** - Tracks which carriers viewed which loads

It also:
- Creates indexes for performance
- Sets up Row Level Security (RLS) policies
- Adds triggers for `updated_at` timestamps
- Adds `source` and `marketplace_load_id` columns to the `loads` table

## After Running the Schema

Once you've run the SQL:
1. Refresh your browser
2. The marketplace page should load without errors
3. You can start posting and accepting loads!

## Optional: Add Demo Data

If you want to see sample loads in the marketplace:
- Run `supabase/insert_demo_marketplace_loads.sql` in the SQL Editor
- This will add 5 sample loads for testing

