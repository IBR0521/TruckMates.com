"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

// Get all vendors
export async function getVendors(filters?: {
  status?: string
  vendor_type?: string
  search?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Use optimized helper with caching
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  // Build query with selective columns and pagination
  let query = supabase
    .from("vendors")
    .select("id, name, company_name, email, phone, status, vendor_type, created_at", { count: "exact" })
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  // Support both vendor_type (new) and service_provided (legacy)
  if (filters?.vendor_type) {
    query = query.or(`vendor_type.eq.${filters.vendor_type},service_provided.eq.${filters.vendor_type}`)
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }

  // Apply pagination (default limit 25 for faster initial loads, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: data || [], error: null, count: count || 0 }
}

// Get single vendor
export async function getVendor(id: string) {
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

  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Create vendor
export async function createVendor(formData: {
  name: string
  company_name?: string
  email?: string
  phone?: string
  website?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  tax_id?: string
  payment_terms?: string
  currency?: string
  vendor_type?: string
  status?: string
  priority?: string
  notes?: string
  tags?: string[]
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
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

  // Professional validation
  if (!validateRequiredString(formData.name, 2, 200)) {
    return { error: "Vendor name is required and must be between 2 and 200 characters", data: null }
  }

  if (formData.email && !validateEmail(formData.email)) {
    return { error: "Invalid email format", data: null }
  }

  if (formData.phone && !validatePhone(formData.phone)) {
    return { error: "Invalid phone number format", data: null }
  }

  if (formData.primary_contact_email && !validateEmail(formData.primary_contact_email)) {
    return { error: "Invalid primary contact email format", data: null }
  }

  if (formData.primary_contact_phone && !validatePhone(formData.primary_contact_phone)) {
    return { error: "Invalid primary contact phone format", data: null }
  }

  // Validate address if provided
  if (formData.city || formData.state || formData.zip) {
    const addressValidation = validateAddress({
      street: formData.address_line1,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
    })
    if (!addressValidation.valid) {
      return { error: addressValidation.errors.join("; "), data: null }
    }
  }

  // Check for duplicate company name if provided
  if (formData.company_name) {
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("company_name", sanitizeString(formData.company_name, 200))
      .single()

    if (existingVendor) {
      return { error: "Vendor with this company name already exists", data: null }
    }
  }

  // Check for duplicate email if provided
  if (formData.email) {
    const { data: existingEmail } = await supabase
      .from("vendors")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("email", sanitizeEmail(formData.email))
      .single()

    if (existingEmail) {
      return { error: "Vendor with this email already exists", data: null }
    }
  }

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      company_id: userData.company_id,
      name: sanitizeString(formData.name, 200),
      company_name: formData.company_name ? sanitizeString(formData.company_name, 200) : null,
      email: formData.email ? sanitizeEmail(formData.email) : null,
      phone: formData.phone ? sanitizePhone(formData.phone) : null,
      website: formData.website ? sanitizeString(formData.website, 200) : null,
      address_line1: formData.address_line1 ? sanitizeString(formData.address_line1, 200) : null,
      address_line2: formData.address_line2 ? sanitizeString(formData.address_line2, 200) : null,
      city: formData.city ? sanitizeString(formData.city, 100) : null,
      state: formData.state ? sanitizeString(formData.state, 2).toUpperCase() : null,
      zip: formData.zip ? sanitizeString(formData.zip, 10) : null,
      country: formData.country || "USA",
      tax_id: formData.tax_id || null,
      payment_terms: formData.payment_terms || "Net 30",
      currency: formData.currency || "USD",
      vendor_type: formData.vendor_type || "supplier",
      status: formData.status || "active",
      priority: formData.priority || "normal",
      notes: formData.notes ? sanitizeString(formData.notes, 2000) : null,
      tags: formData.tags || [],
      primary_contact_name: formData.primary_contact_name ? sanitizeString(formData.primary_contact_name, 100) : null,
      primary_contact_email: formData.primary_contact_email ? sanitizeEmail(formData.primary_contact_email) : null,
      primary_contact_phone: formData.primary_contact_phone ? sanitizePhone(formData.primary_contact_phone) : null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/vendors")
  return { data, error: null }
}

// Update vendor
export async function updateVendor(
  id: string,
  formData: {
    name?: string
    company_name?: string
    email?: string
    phone?: string
    website?: string
    address_line1?: string
    address_line2?: string
    city?: string
    state?: string
    zip?: string
    country?: string
    tax_id?: string
    payment_terms?: string
    currency?: string
    vendor_type?: string
    status?: string
    priority?: string
    notes?: string
    tags?: string[]
    primary_contact_name?: string
    primary_contact_email?: string
    primary_contact_phone?: string
  }
) {
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

  // Get current vendor data for audit trail
  const { data: currentVendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (!currentVendor) {
    return { error: "Vendor not found", data: null }
  }

  // Build update data and track changes
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  const fieldsToCheck = [
    "name", "company_name", "email", "phone", "website", "address_line1", "address_line2",
    "city", "state", "zip", "country", "tax_id", "payment_terms", "currency",
    "vendor_type", "status", "priority", "notes", "primary_contact_name",
    "primary_contact_email", "primary_contact_phone"
  ]

  for (const field of fieldsToCheck) {
    if (formData[field as keyof typeof formData] !== undefined) {
      const newValue = formData[field as keyof typeof formData]
      const oldValue = currentVendor[field]
      if (newValue !== oldValue) {
        updateData[field] = newValue === null || newValue === "" ? null : newValue
        changes.push({ field, old_value: oldValue, new_value: newValue })
      }
    }
  }

  if (formData.tags !== undefined && JSON.stringify(formData.tags) !== JSON.stringify(currentVendor.tags)) {
    updateData.tags = formData.tags || []
    changes.push({ field: "tags", old_value: currentVendor.tags, new_value: formData.tags })
  }

  if (Object.keys(updateData).length === 0) {
    return { data: currentVendor, error: null }
  }

  const { data, error } = await supabase
    .from("vendors")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Create audit log entries
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      if (user) {
        for (const change of changes) {
          try {
            await createAuditLog({
              action: change.field === "status" ? "status_updated" : "data.updated",
              resource_type: "vendor",
              resource_id: id,
              details: {
                field: change.field,
                old_value: change.old_value,
                new_value: change.new_value,
              },
            })
            console.log("[updateVendor] ✅ Audit log created for field:", change.field)
          } catch (err: any) {
            console.error("[updateVendor] ❌ Audit log failed for field", change.field, ":", err.message)
          }
        }
      }
    } catch (err: any) {
      console.error("[updateVendor] Failed to import audit log module:", err.message)
    }
  }

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/vendors/${id}`)
  return { data, error: null }
}

// Delete vendor
export async function deleteVendor(id: string) {
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

  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/vendors")
  return { error: null }
}

// Get vendor's expenses
export async function getVendorExpenses(vendorId: string) {
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

  // Get vendor name first
  const { data: vendor } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", vendorId)
    .eq("company_id", userData.company_id)
    .single()

  if (!vendor) {
    return { error: "Vendor not found", data: null }
  }

  // Get expenses for this vendor (by vendor_id or vendor name)
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("company_id", userData.company_id)
    .or(`vendor_id.eq.${vendorId},vendor.eq.${vendor.name}`)
    .order("date", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get vendor's maintenance records
export async function getVendorMaintenance(vendorId: string) {
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

  // Get vendor name first
  const { data: vendor } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", vendorId)
    .eq("company_id", userData.company_id)
    .single()

  if (!vendor) {
    return { error: "Vendor not found", data: null }
  }

  // Get maintenance records for this vendor (by vendor_id or vendor name)
  const { data, error } = await supabase
    .from("maintenance")
    .select("*")
    .eq("company_id", userData.company_id)
    .or(`vendor_id.eq.${vendorId},vendor.eq.${vendor.name}`)
    .order("scheduled_date", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

