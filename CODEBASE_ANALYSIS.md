# TruckMates Codebase Analysis

**Date:** January 2025  
**Purpose:** Complete codebase pattern analysis for safe feature implementation  
**Status:** ✅ COMPLETE

---

## Executive Summary

This document provides a comprehensive analysis of TruckMates codebase patterns, conventions, and architecture to ensure all new features follow existing patterns exactly and cause zero disruption.

---

## 1. Technology Stack

- **Framework:** Next.js 16.0.7 (App Router)
- **React:** 19.2.0
- **TypeScript:** 5.x (strict mode)
- **Database:** Supabase (PostgreSQL)
- **UI Library:** shadcn/ui (Radix UI + Tailwind CSS)
- **State Management:** React hooks (useState, useEffect)
- **Forms:** react-hook-form (in some places)
- **Notifications:** sonner (toast)
- **Icons:** lucide-react

---

## 2. Architecture Patterns

### 2.1 Server Actions Pattern

**Location:** `app/actions/[feature-name].ts`

**Standard Pattern:**
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { validate[Type]Data, sanitizeString, sanitizeEmail, sanitizePhone } from "@/lib/validation"

export async function get[Items](filters?: {...}) {
  const supabase = await createClient()
  
  // 1. Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }
  
  // 2. Get company_id (cached)
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  if (!company_id) {
    return { error: result.error || "No company found", data: null }
  }
  
  // 3. Query with selective columns and pagination
  let query = supabase
    .from("[table]")
    .select("id, name, ...", { count: "exact" })
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
  
  // 4. Apply filters
  if (filters?.status) query = query.eq("status", filters.status)
  
  // 5. Apply pagination (default 25, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)
  
  // 6. Execute and return
  const { data, error, count } = await query
  if (error) {
    return { error: error.message, data: null, count: 0 }
  }
  return { data: data || [], error: null, count: count || 0 }
}

export async function create[Item](formData: {...}) {
  const supabase = await createClient()
  
  // 1. Authenticate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated", data: null }
  
  // 2. Check subscription limits (if applicable)
  const { canAdd[Item] } = await import("./subscription-limits")
  const limitCheck = await canAdd[Item]()
  if (!limitCheck.allowed) {
    return { error: limitCheck.error || "[Item] limit reached", data: null }
  }
  
  // 3. Get company_id
  const result = await getCachedUserCompany(user.id)
  if (!result.company_id) return { error: "No company found", data: null }
  
  // 4. Validate input
  const validation = validate[Type]Data(formData)
  if (!validation.valid) {
    return { error: validation.errors.join("; "), data: null }
  }
  
  // 5. Check duplicates (if applicable)
  // ... duplicate checks ...
  
  // 6. Sanitize and build data
  const itemData: any = {
    company_id: result.company_id,
    name: sanitizeString(formData.name, 100),
    // ... other fields with sanitization
  }
  
  // 7. Insert
  const { data, error } = await supabase
    .from("[table]")
    .insert(itemData)
    .select()
    .single()
  
  if (error) return { error: error.message, data: null }
  
  // 8. Revalidate
  revalidatePath("/dashboard/[feature]")
  return { data, error: null }
}
```

**Key Rules:**
- ✅ Always authenticate first
- ✅ Always use `getCachedUserCompany` for company_id
- ✅ Always validate input using `lib/validation`
- ✅ Always sanitize strings, emails, phones
- ✅ Always return `{ error: string | null, data: T | null }`
- ✅ Always use `revalidatePath` after mutations
- ✅ Use selective columns in SELECT queries
- ✅ Default pagination: limit 25, max 100
- ✅ Check subscription limits before creating

---

### 2.2 Page Component Pattern

**Location:** `app/dashboard/[feature]/page.tsx`

**List Page Pattern:**
```typescript
"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Edit2, Trash2, Eye, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { get[Items], delete[Item], bulkDelete[Items] } from "@/app/actions/[feature]"

export default function [Items]Page() {
  const [itemsList, setItemsList] = useState<any[]>([])
  const [filteredItems, setFilteredItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  const loadItems = async () => {
    setIsLoading(true)
    const result = await get[Items]()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setItemsList(result.data)
      setFilteredItems(result.data)
    }
    setIsLoading(false)
  }
  
  useEffect(() => {
    loadItems()
  }, [])
  
  // Filter and sort
  useEffect(() => {
    let filtered = [...itemsList]
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter)
    }
    setFilteredItems(filtered)
  }, [itemsList, searchTerm, statusFilter])
  
  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">[Items]</h1>
          <p className="text-muted-foreground text-sm mt-1">[Description]</p>
        </div>
        <Link href="/dashboard/[feature]/add">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </Link>
      </div>
      
      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
          
          {/* List/Grid */}
          {isLoading ? (
            <div>Loading...</div>
          ) : filteredItems.length === 0 ? (
            <Card className="p-8 text-center">
              <p>No items found</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="p-6">
                  {/* Item content */}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Key Rules:**
- ✅ Always use "use client"
- ✅ Use useState for local state
- ✅ Use useEffect for data loading
- ✅ Use toast.error/toast.success for feedback
- ✅ Handle loading and empty states
- ✅ Use Card components for sections
- ✅ Use consistent header pattern

---

### 2.3 Form Page Pattern

**Location:** `app/dashboard/[feature]/add/page.tsx` or `app/dashboard/[feature]/[id]/edit/page.tsx`

**Standard Pattern:**
```typescript
"use client"

import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { create[Item], update[Item] } from "@/app/actions/[feature]"

export default function Add[Item]Page() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    // ... other fields
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const result = await create[Item](formData)
    
    setIsSubmitting(false)
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("[Item] added successfully")
      router.push("/dashboard/[feature]")
    }
  }
  
  return (
    <FormPageLayout
      title="Add [Item]"
      subtitle="[Description]"
      backUrl="/dashboard/[feature]"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Create [Item]"
    >
      <FormSection title="Basic Information">
        <FormGrid cols={2}>
          <div>
            <Label>Name *</Label>
            <Input
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
        </FormGrid>
      </FormSection>
    </FormPageLayout>
  )
}
```

**Key Rules:**
- ✅ Use FormPageLayout component
- ✅ Use FormSection and FormGrid
- ✅ Handle form submission with toast feedback
- ✅ Redirect on success
- ✅ Show loading state during submission

---

### 2.4 Detail Page Pattern

**Location:** `app/dashboard/[feature]/[id]/page.tsx`

**Standard Pattern:**
```typescript
"use client"

import { DetailPageLayout, DetailSection, InfoGrid, InfoField } from "@/components/dashboard/detail-page-layout"
import { Card } from "@/components/ui/card"
import { get[Item] } from "@/app/actions/[feature]"

export default function [Item]DetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    async function loadItem() {
      const result = await get[Item](params.id)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setItem(result.data)
      }
      setIsLoading(false)
    }
    loadItem()
  }, [params.id])
  
  if (isLoading) return <div>Loading...</div>
  if (!item) return <div>Item not found</div>
  
  return (
    <DetailPageLayout
      title={item.name}
      subtitle={item.description}
      backUrl="/dashboard/[feature]"
      editUrl={`/dashboard/[feature]/${params.id}/edit`}
    >
      <DetailSection title="Information">
        <InfoGrid cols={2}>
          <InfoField label="Name" value={item.name} />
        </InfoGrid>
      </DetailSection>
    </DetailPageLayout>
  )
}
```

**Key Rules:**
- ✅ Use DetailPageLayout component
- ✅ Use DetailSection, InfoGrid, InfoField
- ✅ Handle loading and not found states
- ✅ Provide edit link

---

## 3. Validation Patterns

**Location:** `lib/validation.ts`

**Standard Functions:**
- `validateEmail(email: string): boolean`
- `validatePhone(phone: string): boolean`
- `validateRequiredString(value: string, minLength, maxLength): boolean`
- `validateDate(dateString: string): boolean`
- `validate[Type]Data(data: {...}): ValidationResult`
- `sanitizeString(input: string, maxLength?): string`
- `sanitizeEmail(email: string): string`
- `sanitizePhone(phone: string): string`

**Usage:**
```typescript
const validation = validateDriverData(formData)
if (!validation.valid) {
  return { error: validation.errors.join("; "), data: null }
}
```

---

## 4. Database Patterns

### 4.1 Query Pattern
- Always filter by `company_id` for data isolation
- Use selective columns in SELECT
- Use pagination (default 25, max 100)
- Order by `created_at DESC` for lists
- Use `.single()` for detail queries with error handling

### 4.2 RLS (Row Level Security)
- All tables have RLS enabled
- Policies filter by `company_id`
- Server actions automatically respect RLS

### 4.3 Caching
- Use `getCachedUserCompany` for company_id (5 min cache)
- Cache dashboard stats (60 seconds)

---

## 5. UI Component Patterns

### 5.1 Layout Components
- `DetailPageLayout` - For detail pages
- `FormPageLayout` - For add/edit forms
- `FormSection` - Section wrapper in forms
- `FormGrid` - Grid layout in forms
- `DetailSection` - Section wrapper in detail pages
- `InfoGrid` - Grid layout in detail pages
- `InfoField` - Field display in detail pages

### 5.2 UI Components (shadcn/ui)
- `Card` - Content containers
- `Button` - Actions
- `Input` - Text inputs
- `Select` - Dropdowns
- `Badge` - Status indicators
- `Dialog` / `AlertDialog` - Modals
- `Toast` (via sonner) - Notifications

### 5.3 Status Badges
```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
    case "completed":
      return "bg-green-500/10 text-green-500 border-green-500/20"
    case "pending":
    case "in_progress":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    case "inactive":
    case "expired":
      return "bg-red-500/10 text-red-500 border-red-500/20"
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20"
  }
}
```

---

## 6. Error Handling Patterns

### 6.1 Server Actions
- Always return `{ error: string | null, data: T | null }`
- Never throw errors
- Return descriptive error messages

### 6.2 Client Components
- Use try-catch for async operations
- Show toast.error for errors
- Show toast.success for success
- Handle loading states
- Handle empty states

---

## 7. File Structure

```
app/
  actions/          # Server actions (one file per feature)
  dashboard/        # Dashboard pages
    [feature]/
      page.tsx      # List page
      add/
        page.tsx    # Add form
      [id]/
        page.tsx    # Detail page
        edit/
          page.tsx  # Edit form
components/
  dashboard/        # Dashboard-specific components
  ui/              # shadcn/ui components
lib/
  validation.ts    # Validation utilities
  query-optimizer.ts # Query optimization
  supabase/        # Supabase utilities
```

---

## 8. Naming Conventions

- **Files:** kebab-case (`drivers.ts`, `add-driver.tsx`)
- **Functions:** camelCase (`getDrivers`, `createDriver`)
- **Components:** PascalCase (`DriversPage`, `AddDriverPage`)
- **Variables:** camelCase (`driversList`, `isLoading`)
- **Constants:** UPPER_SNAKE_CASE (if needed)

---

## 9. Critical Rules for New Features

### ✅ DO:
1. Follow exact server action pattern
2. Use existing layout components
3. Validate all inputs
4. Sanitize all strings
5. Handle errors gracefully
6. Use consistent UI patterns
7. Add loading states
8. Add empty states
9. Use toast for feedback
10. Revalidate paths after mutations

### ❌ DON'T:
1. Modify existing server actions
2. Change existing page structures
3. Skip validation
4. Skip sanitization
5. Throw errors (return error objects)
6. Create new UI patterns (use existing)
7. Skip loading states
8. Skip error handling
9. Modify existing database tables (add new ones)
10. Break existing functionality

---

## 10. Testing Checklist

Before adding any feature:
- [ ] Review similar existing feature
- [ ] Follow exact server action pattern
- [ ] Use existing layout components
- [ ] Add validation
- [ ] Add sanitization
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with different user roles
- [ ] Test error cases
- [ ] Verify no breaking changes

---

## Conclusion

This codebase follows **strict, consistent patterns**. All new features must:
1. Follow these patterns exactly
2. Use existing components
3. Not modify existing code
4. Be fully tested
5. Handle all edge cases

**Next Steps:** Implement features following this analysis exactly.

---

**Document Version:** 1.0  
**Last Updated:** January 2025


