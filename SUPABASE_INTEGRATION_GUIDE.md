# Complete Supabase Integration Guide

## Part 1: Initial Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: TruckMates
   - **Database Password**: (save this!)
   - **Region**: Choose closest to you
4. Wait 1-2 minutes for setup

### Step 2: Get API Keys

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJ...` (long string)

### Step 3: Set Environment Variables

1. Create `.env.local` in your project root:
   ```bash
   touch .env.local
   ```

2. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

### Step 4: Run Database Schema

1. In Supabase dashboard → **SQL Editor**
2. Open `supabase/schema.sql` from your project
3. Copy ALL the SQL code
4. Paste into Supabase SQL Editor
5. Click **"Run"**
6. Wait for "Success" message

---

## Part 2: Understanding the Connection

### How Your App Connects to Supabase

Your app uses **API calls** to communicate with Supabase:

```
Your Next.js App
    ↓ (HTTP Request)
Supabase API
    ↓
PostgreSQL Database
```

### Two Types of Components

1. **Server Components** (default in Next.js 13+)
   - Run on server
   - Can directly query database
   - Use `createClient()` from `lib/supabase/server.ts`

2. **Client Components** (marked with "use client")
   - Run in browser
   - Use `createClient()` from `lib/supabase/client.ts`
   - Good for forms, buttons, real-time updates

---

## Part 3: Authentication Backend

### Login Function

**File: `app/login/page.tsx`** (already updated, but here's the full version)

```typescript
"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Handle error
      console.error("Login error:", error.message)
      return { error: error.message }
    }

    if (data.user) {
      // Success! Redirect to dashboard
      router.push("/dashboard")
      return { success: true }
    }
  }
}
```

### Register Function

**File: `app/register/manager/page.tsx`**

```typescript
"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function ManagerRegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (formData: {
    companyName: string
    email: string
    password: string
    phone: string
  }) => {
    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.companyName,
          role: "manager",
        },
      },
    })

    if (authError) {
      return { error: authError.message }
    }

    if (!authData.user) {
      return { error: "Failed to create user" }
    }

    // Step 2: Create company
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: formData.companyName,
        email: formData.email,
        phone: formData.phone,
      })
      .select()
      .single()

    if (companyError) {
      return { error: companyError.message }
    }

    // Step 3: Link user to company
    const { error: userError } = await supabase
      .from("users")
      .update({
        company_id: companyData.id,
        role: "manager",
        full_name: formData.companyName,
        phone: formData.phone,
      })
      .eq("id", authData.user.id)

    if (userError) {
      return { error: userError.message }
    }

    // Success! Redirect to plans
    router.push("/plans?type=manager")
    return { success: true }
  }
}
```

---

## Part 4: Database Operations (Backend)

### Using Server Actions (Recommended for Next.js 13+)

Create server actions file: `app/actions/drivers.ts`

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all drivers for current user's company
export async function getDrivers() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Get user's company_id
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: "No company found" }
  }

  // Get drivers for this company
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: drivers }
}

// Create a new driver
export async function createDriver(formData: FormData) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // Get user's company_id
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found" }
  }

  // Create driver
  const { data, error } = await supabase
    .from("drivers")
    .insert({
      company_id: userData.company_id,
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      license_number: formData.get("license") as string,
      status: "active",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Revalidate the drivers page to show new data
  revalidatePath("/dashboard/drivers")

  return { data, success: true }
}

// Update a driver
export async function updateDriver(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("drivers")
    .update({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      license_number: formData.get("license") as string,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/drivers")
  revalidatePath(`/dashboard/drivers/${id}`)

  return { data, success: true }
}

// Delete a driver
export async function deleteDriver(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("drivers").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/drivers")

  return { success: true }
}
```

### Using API Routes (Alternative Method)

Create API route: `app/api/drivers/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET /api/drivers - Get all drivers
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("company_id", userData?.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: drivers })
}

// POST /api/drivers - Create a driver
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  const { data, error } = await supabase
    .from("drivers")
    .insert({
      company_id: userData?.company_id,
      ...body,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, success: true })
}
```

---

## Part 5: Using in Components

### Server Component Example (Recommended)

**File: `app/dashboard/drivers/page.tsx`**

```typescript
import { getDrivers } from "@/app/actions/drivers"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DriversPage() {
  // Check authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get drivers data
  const { data: drivers, error } = await getDrivers()

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div>
      <h1>Drivers</h1>
      {drivers?.map((driver) => (
        <div key={driver.id}>
          <h3>{driver.name}</h3>
          <p>{driver.email}</p>
        </div>
      ))}
    </div>
  )
}
```

### Client Component Example (For Forms)

**File: `app/dashboard/drivers/add/page.tsx`**

```typescript
"use client"

import { createDriver } from "@/app/actions/drivers"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AddDriverPage() {
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    const result = await createDriver(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Driver created successfully!")
      router.push("/dashboard/drivers")
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="name" placeholder="Driver Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="phone" placeholder="Phone" required />
      <input name="license" placeholder="License Number" required />
      <button type="submit">Create Driver</button>
    </form>
  )
}
```

---

## Part 6: Complete Example - Drivers Page

Let me create a complete working example for you.

