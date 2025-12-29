"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all vendors
export async function getVendors(filters?: {
  status?: string
  vendor_type?: string
  search?: string
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

  let query = supabase
    .from("vendors")
    .select("*")
    .eq("company_id", userData.company_id)
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

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
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

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      company_id: userData.company_id,
      name: formData.name,
      company_name: formData.company_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      website: formData.website || null,
      address_line1: formData.address_line1 || null,
      address_line2: formData.address_line2 || null,
      city: formData.city || null,
      state: formData.state || null,
      zip: formData.zip || null,
      country: formData.country || "USA",
      tax_id: formData.tax_id || null,
      payment_terms: formData.payment_terms || "Net 30",
      currency: formData.currency || "USD",
      vendor_type: formData.vendor_type || "supplier",
      status: formData.status || "active",
      priority: formData.priority || "normal",
      notes: formData.notes || null,
      tags: formData.tags || [],
      primary_contact_name: formData.primary_contact_name || null,
      primary_contact_email: formData.primary_contact_email || null,
      primary_contact_phone: formData.primary_contact_phone || null,
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

  const updateData: any = {}
  if (formData.name !== undefined) updateData.name = formData.name
  if (formData.company_name !== undefined) updateData.company_name = formData.company_name || null
  if (formData.email !== undefined) updateData.email = formData.email || null
  if (formData.phone !== undefined) updateData.phone = formData.phone || null
  if (formData.website !== undefined) updateData.website = formData.website || null
  if (formData.address_line1 !== undefined) updateData.address_line1 = formData.address_line1 || null
  if (formData.address_line2 !== undefined) updateData.address_line2 = formData.address_line2 || null
  if (formData.city !== undefined) updateData.city = formData.city || null
  if (formData.state !== undefined) updateData.state = formData.state || null
  if (formData.zip !== undefined) updateData.zip = formData.zip || null
  if (formData.country !== undefined) updateData.country = formData.country || "USA"
  if (formData.tax_id !== undefined) updateData.tax_id = formData.tax_id || null
  if (formData.payment_terms !== undefined) updateData.payment_terms = formData.payment_terms || "Net 30"
  if (formData.currency !== undefined) updateData.currency = formData.currency || "USD"
  if (formData.vendor_type !== undefined) updateData.vendor_type = formData.vendor_type || "supplier"
  if (formData.status !== undefined) updateData.status = formData.status || "active"
  if (formData.priority !== undefined) updateData.priority = formData.priority || "normal"
  if (formData.notes !== undefined) updateData.notes = formData.notes || null
  if (formData.tags !== undefined) updateData.tags = formData.tags || []
  if (formData.primary_contact_name !== undefined) updateData.primary_contact_name = formData.primary_contact_name || null
  if (formData.primary_contact_email !== undefined) updateData.primary_contact_email = formData.primary_contact_email || null
  if (formData.primary_contact_phone !== undefined) updateData.primary_contact_phone = formData.primary_contact_phone || null

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

