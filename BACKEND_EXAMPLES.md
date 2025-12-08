# Backend Code Examples

## How to Use Server Actions in Your Components

### Example 1: Drivers Page (Server Component)

**File: `app/dashboard/drivers/page.tsx`**

```typescript
import { getDrivers } from "@/app/actions/drivers"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function DriversPage() {
  // Check if user is authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch drivers from database
  const { data: drivers, error } = await getDrivers()

  if (error) {
    return <div>Error loading drivers: {error}</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1>Drivers</h1>
        <Link href="/dashboard/drivers/add">
          <Button>Add Driver</Button>
        </Link>
      </div>

      {drivers && drivers.length > 0 ? (
        <div className="grid gap-4">
          {drivers.map((driver) => (
            <div key={driver.id} className="border p-4 rounded">
              <h3>{driver.name}</h3>
              <p>{driver.email}</p>
              <p>{driver.phone}</p>
              <Link href={`/dashboard/drivers/${driver.id}`}>
                <Button>View Details</Button>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p>No drivers found. Add your first driver!</p>
      )}
    </div>
  )
}
```

### Example 2: Add Driver Form (Client Component)

**File: `app/dashboard/drivers/add/page.tsx`**

```typescript
"use client"

import { createDriver } from "@/app/actions/drivers"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

export default function AddDriverPage() {
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const result = await createDriver({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      license_number: formData.get("license") as string,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Driver created successfully!")
      router.push("/dashboard/drivers")
    }
  }

  return (
    <Card className="p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Driver</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Full Name</label>
          <Input name="name" required />
        </div>
        <div>
          <label>Email</label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <label>Phone</label>
          <Input name="phone" required />
        </div>
        <div>
          <label>License Number</label>
          <Input name="license" required />
        </div>
        <Button type="submit">Create Driver</Button>
      </form>
    </Card>
  )
}
```

### Example 3: Update Driver (Client Component)

**File: `app/dashboard/drivers/[id]/edit/page.tsx`**

```typescript
"use client"

import { updateDriver, getDriver } from "@/app/actions/drivers"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { use } from "react"

export default function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [driver, setDriver] = useState<any>(null)

  useEffect(() => {
    async function loadDriver() {
      const { data, error } = await getDriver(id)
      if (error) {
        toast.error(error)
        router.push("/dashboard/drivers")
      } else {
        setDriver(data)
        setLoading(false)
      }
    }
    loadDriver()
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const result = await updateDriver(id, {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      license_number: formData.get("license") as string,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Driver updated successfully!")
      router.push(`/dashboard/drivers/${id}`)
    }
  }

  if (loading) return <div>Loading...</div>
  if (!driver) return <div>Driver not found</div>

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" defaultValue={driver.name} required />
      <input name="email" type="email" defaultValue={driver.email} required />
      <input name="phone" defaultValue={driver.phone} required />
      <input name="license" defaultValue={driver.license_number} required />
      <button type="submit">Update Driver</button>
    </form>
  )
}
```

---

## Authentication Examples

### Login with Supabase

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
      console.error("Login error:", error.message)
      return { error: error.message }
    }

    if (data.user) {
      router.push("/dashboard")
      return { success: true }
    }
  }
}
```

### Register Manager with Company Creation

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

    // Step 3: Update user with company_id
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

    router.push("/plans?type=manager")
    return { success: true }
  }
}
```

---

## File Upload Example (Documents)

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function uploadDocument(file: File, metadata: {
  name: string
  type: string
  truck_id?: string
  driver_id?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Upload file to Supabase Storage
  const fileExt = file.name.split(".").pop()
  const fileName = `${user.id}/${Date.now()}.${fileExt}`
  const filePath = `documents/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, file)

  if (uploadError) {
    return { error: uploadError.message, data: null }
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath)

  // Save document record to database
  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: userData.company_id,
      name: metadata.name,
      type: metadata.type,
      file_url: urlData.publicUrl,
      file_size: file.size,
      upload_date: new Date().toISOString().split("T")[0],
      truck_id: metadata.truck_id,
      driver_id: metadata.driver_id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/documents")
  return { data, error: null }
}
```

---

## Common Patterns

### Pattern 1: Get Current User's Company

```typescript
async function getCurrentUserCompany() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  return userData
}
```

### Pattern 2: Check if User is Manager

```typescript
async function isManager() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  return userData?.role === "manager"
}
```

### Pattern 3: Query with Company Filter

```typescript
async function getCompanyData(tableName: string) {
  const supabase = await createClient()
  
  const userCompany = await getCurrentUserCompany()
  if (!userCompany?.company_id) {
    return { error: "No company", data: null }
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("company_id", userCompany.company_id)

  return { data, error }
}
```

---

## Testing Your Backend

### Test in Browser Console

```javascript
// In browser console on your app
const supabase = createClient()

// Test connection
const { data, error } = await supabase.from('drivers').select('*')
console.log(data, error)
```

### Test in Server Action

Add console.logs:
```typescript
export async function getDrivers() {
  console.log("Getting drivers...")
  const supabase = await createClient()
  // ... rest of code
  console.log("Drivers:", data)
  return { data, error }
}
```

---

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Add environment variables
3. ✅ Run database schema
4. ✅ Use server actions in your components
5. ✅ Replace mock data with real database queries
6. ✅ Test authentication flow
7. ✅ Test CRUD operations

