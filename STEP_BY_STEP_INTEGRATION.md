# Step-by-Step: Connect Supabase to Your SaaS App

## Quick Start (15 minutes)

### Step 1: Set Up Supabase (5 min)

1. **Create Account & Project**
   - Go to [supabase.com](https://supabase.com)
   - Sign up/login
   - Click "New Project"
   - Name: "TruckMates"
   - Choose region
   - Create project

2. **Get API Keys**
   - Settings → API
   - Copy **Project URL** and **anon public key**

3. **Add to `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

4. **Run Database Schema**
   - Supabase Dashboard → SQL Editor
   - Copy code from `supabase/schema.sql`
   - Paste and click "Run"

### Step 2: Test Connection (2 min)

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Test in browser console:**
   ```javascript
   // Open browser console on your app
   const { createClient } = await import('@/lib/supabase/client')
   const supabase = createClient()
   const { data, error } = await supabase.from('drivers').select('*')
   console.log('Test:', data, error)
   ```

### Step 3: Update One Page (Example: Drivers) (8 min)

#### 3a. Update Drivers List Page

**File: `app/dashboard/drivers/page.tsx`**

Change from:
```typescript
"use client"
const drivers = [/* mock data */]
```

To:
```typescript
import { getDrivers } from "@/app/actions/drivers"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/login")
  
  const { data: drivers, error } = await getDrivers()
  
  // Use drivers from database instead of mock data
}
```

#### 3b. Update Add Driver Form

**File: `app/dashboard/drivers/add/page.tsx`**

Change form submission to:
```typescript
import { createDriver } from "@/app/actions/drivers"

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  const result = await createDriver({
    name: formData.name,
    email: formData.email,
    // ... other fields
  })
  
  if (result.error) {
    toast.error(result.error)
  } else {
    toast.success("Driver created!")
    router.push("/dashboard/drivers")
  }
}
```

#### 3c. Update Delete Function

Use the `DeleteDriverButton` component I created, or:
```typescript
import { deleteDriver } from "@/app/actions/drivers"

const handleDelete = async (id: string) => {
  const result = await deleteDriver(id)
  if (result.error) {
    toast.error(result.error)
  } else {
    toast.success("Deleted!")
    // Refresh page or remove from list
  }
}
```

---

## Understanding the Flow

### How Data Flows

```
User Action (Click Button)
    ↓
Client Component (Form/Button)
    ↓
Server Action (app/actions/drivers.ts)
    ↓
Supabase Client (lib/supabase/server.ts)
    ↓
Supabase API (HTTP Request)
    ↓
PostgreSQL Database
    ↓
Response Back
    ↓
Update UI
```

### Example: Creating a Driver

1. **User fills form** → Client Component
2. **Clicks submit** → Calls `createDriver()` action
3. **Server Action** → Gets user, gets company_id
4. **Supabase Insert** → Adds to database
5. **Success** → Refreshes page, shows new driver

---

## Common Operations

### 1. Get All Records

```typescript
// Server Action
export async function getDrivers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get company_id
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()
  
  // Get drivers
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("company_id", userData.company_id)
  
  return { data, error }
}
```

### 2. Create Record

```typescript
export async function createDriver(formData: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get company_id
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()
  
  // Insert
  const { data, error } = await supabase
    .from("drivers")
    .insert({
      company_id: userData.company_id,
      ...formData
    })
    .select()
    .single()
  
  return { data, error }
}
```

### 3. Update Record

```typescript
export async function updateDriver(id: string, formData: any) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("drivers")
    .update(formData)
    .eq("id", id)
    .select()
    .single()
  
  return { data, error }
}
```

### 4. Delete Record

```typescript
export async function deleteDriver(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("drivers")
    .delete()
    .eq("id", id)
  
  return { error }
}
```

---

## Testing Checklist

After connecting Supabase:

- [ ] Can I see data in Supabase dashboard?
- [ ] Can I create a new record?
- [ ] Can I update a record?
- [ ] Can I delete a record?
- [ ] Does authentication work?
- [ ] Are RLS policies working (users only see their company's data)?

---

## Troubleshooting

### "Not authenticated" error
- User not logged in
- Check `supabase.auth.getUser()` returns user

### "No company found" error
- User doesn't have `company_id` set
- Go to Supabase dashboard → users table → set company_id

### RLS policy error
- Check policies in Supabase dashboard
- Make sure user has company_id set
- Verify policies allow SELECT/INSERT/UPDATE/DELETE

### Data not showing
- Check browser console for errors
- Check Supabase dashboard → Table Editor → see if data exists
- Verify company_id matches

---

## Next Steps

1. ✅ Set up Supabase
2. ✅ Test connection
3. ✅ Update Drivers page
4. ⏭️ Update Trucks page
5. ⏭️ Update Routes page
6. ⏭️ Update Loads page
7. ⏭️ Update all other pages

---

## Files Created for You

- ✅ `app/actions/drivers.ts` - Driver operations
- ✅ `app/actions/trucks.ts` - Truck operations
- ✅ `app/actions/loads.ts` - Load operations
- ✅ `app/actions/routes.ts` - Route operations
- ✅ `app/dashboard/drivers/delete-button.tsx` - Delete component
- ✅ `SUPABASE_INTEGRATION_GUIDE.md` - Complete guide
- ✅ `BACKEND_EXAMPLES.md` - Code examples
- ✅ `STEP_BY_STEP_INTEGRATION.md` - This file

You're all set! Start with one page (like Drivers) and then apply the same pattern to others.

