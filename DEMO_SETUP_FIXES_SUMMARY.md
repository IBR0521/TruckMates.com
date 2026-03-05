# Demo Setup Fixes - Complete Analysis & Resolution

## Issues Found and Fixed

### 1. **RPC Function Signature Mismatch** ✅ FIXED
- **Problem**: `create_company_for_user` expects 5 parameters but demo setup was calling with 4
- **Fix**: Added `p_company_type: null` parameter to the RPC call in `app/actions/demo.ts`

### 2. **Missing Demo Data Population** ✅ FIXED
- **Problem**: Demo setup only created company/user, didn't populate demo data
- **Fix**: Created `populate_demo_data_for_company()` PostgreSQL function and integrated it into demo setup
- **File**: `supabase/populate_demo_data_function.sql`

### 3. **Connection Timeouts Too Short** ✅ FIXED
- **Problem**: 5-second timeouts causing failures on slow connections
- **Fixes**:
  - Auth timeout: 5s → 15s
  - RPC timeout: 10s → 20s
  - Fetch timeout: 5s → 15s (both client and server)
- **Files**: `app/actions/demo.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`

### 4. **SQL Function Errors** ✅ FIXED
- **Problem**: `ON CONFLICT DO NOTHING` used on tables without unique constraints
- **Fix**: Changed to check existence first, then insert only if not exists
- **Tables Fixed**: drivers, routes, loads, maintenance
- **File**: `supabase/populate_demo_data_function.sql`

### 5. **Missing Variable Declarations** ✅ FIXED
- **Problem**: Variables used but not declared in function
- **Fix**: Added all required variables to DECLARE section
- **File**: `supabase/populate_demo_data_function.sql`

## Files Modified

1. **app/actions/demo.ts**
   - Fixed RPC call signature
   - Added automatic demo data population
   - Increased timeouts

2. **lib/supabase/server.ts**
   - Increased fetch timeout to 15 seconds
   - Better error handling

3. **lib/supabase/client.ts**
   - Increased fetch timeout to 15 seconds
   - Better error messages

4. **supabase/populate_demo_data_function.sql** (NEW)
   - Complete automated demo data population function
   - Handles all edge cases
   - Safe for multiple executions

## Required SQL Setup

**IMPORTANT**: Run these SQL files in Supabase SQL Editor (in order):

1. `supabase/fix_companies_rls_v3.sql` - Creates `create_company_for_user` function
2. `supabase/populate_demo_data_function.sql` - Creates `populate_demo_data_for_company` function

## Environment Variables Required

Make sure these are set in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Testing

After fixes:
1. Demo setup should work automatically
2. Demo data will populate automatically
3. No manual SQL execution needed
4. Better error messages if connection fails

## Known Issues Resolved

- ✅ RPC function signature mismatch
- ✅ Missing demo data population
- ✅ Connection timeout errors
- ✅ SQL constraint violations
- ✅ Missing variable declarations
- ✅ ON CONFLICT errors on tables without unique constraints















