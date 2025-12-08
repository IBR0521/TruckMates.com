# Quick Start: Connect Supabase in 5 Steps

## Step 1: Create Supabase Project (2 min)

1. Go to [supabase.com](https://supabase.com) → Sign up
2. Click "New Project"
3. Fill in details → Create
4. Wait 1-2 minutes

## Step 2: Get API Keys (1 min)

1. Settings → API
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJ...` (long string)

## Step 3: Add Environment Variables (1 min)

Create `.env.local` in project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Restart dev server:**
```bash
npm run dev
```

## Step 4: Set Up Database (2 min)

1. Supabase Dashboard → SQL Editor
2. Open `supabase/schema.sql` from your project
3. Copy ALL SQL code
4. Paste in Supabase SQL Editor
5. Click "Run"
6. Wait for "Success"

## Step 5: Test It! (1 min)

Your app is now connected! The server actions I created will work:

- ✅ `app/actions/drivers.ts` - Ready to use
- ✅ `app/actions/trucks.ts` - Ready to use
- ✅ `app/actions/loads.ts` - Ready to use
- ✅ `app/actions/routes.ts` - Ready to use

---

## How to Use

### In Your Components:

**Get Data:**
```typescript
import { getDrivers } from "@/app/actions/drivers"

// In Server Component
const { data: drivers, error } = await getDrivers()
```

**Create Data:**
```typescript
import { createDriver } from "@/app/actions/drivers"

// In Client Component
const result = await createDriver({
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  license_number: "DL123456"
})
```

**Update Data:**
```typescript
import { updateDriver } from "@/app/actions/drivers"

const result = await updateDriver(id, {
  name: "Updated Name"
})
```

**Delete Data:**
```typescript
import { deleteDriver } from "@/app/actions/drivers"

const result = await deleteDriver(id)
```

---

## What Happens Behind the Scenes

1. **Your Code** calls `createDriver()`
2. **Server Action** gets current user
3. **Gets company_id** from user record
4. **Inserts into Supabase** database
5. **Returns result** to your component
6. **UI updates** automatically

---

## Files You Have

✅ **Server Actions** (Backend):
- `app/actions/drivers.ts`
- `app/actions/trucks.ts`
- `app/actions/loads.ts`
- `app/actions/routes.ts`

✅ **Supabase Clients**:
- `lib/supabase/client.ts` - For client components
- `lib/supabase/server.ts` - For server components

✅ **Database Schema**:
- `supabase/schema.sql` - All tables and policies

✅ **Documentation**:
- `SUPABASE_INTEGRATION_GUIDE.md` - Complete guide
- `BACKEND_EXAMPLES.md` - Code examples
- `STEP_BY_STEP_INTEGRATION.md` - Detailed steps

---

## Next: Update Your Pages

1. Start with **Drivers page**
2. Replace mock data with `getDrivers()`
3. Update forms to use `createDriver()`
4. Test it works!
5. Then do the same for Trucks, Routes, Loads, etc.

---

## Need Help?

Check the detailed guides:
- `SUPABASE_INTEGRATION_GUIDE.md` - Full integration guide
- `BACKEND_EXAMPLES.md` - Complete code examples

