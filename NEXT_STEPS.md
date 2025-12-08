# Next Steps: Integrating Supabase

## ✅ What's Been Set Up

1. **Supabase packages installed** - `@supabase/supabase-js` and `@supabase/ssr`
2. **Database schema** - Complete SQL schema in `supabase/schema.sql`
3. **TypeScript types** - Database types in `lib/supabase/types.ts`
4. **Client & Server utilities** - Supabase clients in `lib/supabase/`
5. **Helper functions** - Database query functions in `lib/supabase/queries.ts`
6. **Authentication middleware** - Already configured in `middleware.ts`

## 🚀 What You Need to Do Now

### 1. Set Up Supabase Project (5 minutes)

Follow the **SUPABASE_QUICK_START.md** guide:
- Create Supabase project
- Get API keys
- Set up `.env.local` file
- Run the database schema SQL
- Create storage bucket for documents

### 2. Update Components to Use Database

Replace mock data with real database queries. Example:

**Before (mock data):**
```typescript
const drivers = [
  { id: 1, name: "John Smith", ... },
  { id: 2, name: "Sarah Davis", ... }
]
```

**After (Supabase):**
```typescript
// In a Server Component
import { getDrivers, getUserCompanyId } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/login")
  
  const companyId = await getUserCompanyId(user.id)
  if (!companyId) return <div>No company assigned</div>
  
  const { data: drivers, error } = await getDrivers(companyId)
  
  // Handle error and render drivers
}
```

### 3. Update Authentication

Update login/register pages to use Supabase Auth:

**Login:**
```typescript
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})
```

**Register:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: name,
      role: "manager" // or "user"
    }
  }
})
```

### 4. Update Forms to Save Data

Replace form submissions with database inserts:

```typescript
import { createDriver } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const companyId = await getUserCompanyId(user.id)

const { data, error } = await createDriver({
  company_id: companyId,
  name: formData.name,
  email: formData.email,
  // ... other fields
})
```

## 📋 Priority Order

1. **Set up Supabase project** (follow SUPABASE_QUICK_START.md)
2. **Update authentication** (login/register pages)
3. **Update Drivers page** (list, add, edit, delete)
4. **Update Trucks page**
5. **Update Routes page**
6. **Update Loads page**
7. **Update Accounting pages** (invoices, expenses, settlements)
8. **Update Maintenance page**
9. **Update IFTA Reports**
10. **Update Documents page** (with file upload)

## 🔧 Helper Functions Available

All in `lib/supabase/queries.ts`:

- **Drivers**: `getDrivers`, `getDriver`, `createDriver`, `updateDriver`, `deleteDriver`
- **Trucks**: `getTrucks`, `getTruck`, `createTruck`, `updateTruck`, `deleteTruck`
- **Routes**: `getRoutes`, `getRoute`, `createRoute`, `updateRoute`, `deleteRoute`
- **Loads**: `getLoads`, `getLoad`, `createLoad`, `updateLoad`, `deleteLoad`
- **Invoices**: `getInvoices`, `getInvoice`, `createInvoice`, `updateInvoice`, `deleteInvoice`
- **Expenses**: `getExpenses`, `getExpense`, `createExpense`, `updateExpense`, `deleteExpense`
- **Settlements**: `getSettlements`, `getSettlement`, `createSettlement`, `updateSettlement`
- **Maintenance**: `getMaintenance`, `getMaintenanceRecord`, `createMaintenance`, `updateMaintenance`, `deleteMaintenance`
- **IFTA Reports**: `getIFTAReports`, `getIFTAReport`, `createIFTAReport`
- **Documents**: `getDocuments`, `getDocument`, `createDocument`, `deleteDocument`

## 📝 Notes

- All queries automatically filter by `company_id` (RLS policies handle this)
- Use Server Components for data fetching when possible
- Use Client Components with `createClient()` from `lib/supabase/client` for client-side operations
- Always check authentication before database operations
- Handle errors gracefully with user-friendly messages

## 🆘 Need Help?

- Check `SUPABASE_QUICK_START.md` for setup instructions
- Check `SUPABASE_SETUP.md` for detailed documentation
- Review Supabase docs: https://supabase.com/docs

