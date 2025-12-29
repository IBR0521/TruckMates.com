"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all customers
export async function getCustomers(filters?: {
  status?: string
  customer_type?: string
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
    .from("customers")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.customer_type) {
    query = query.eq("customer_type", filters.customer_type)
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

// Get single customer
export async function getCustomer(id: string) {
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
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Create customer
export async function createCustomer(formData: {
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
  mailing_address_line1?: string
  mailing_address_line2?: string
  mailing_city?: string
  mailing_state?: string
  mailing_zip?: string
  mailing_country?: string
  physical_address_line1?: string
  physical_address_line2?: string
  physical_city?: string
  physical_state?: string
  physical_zip?: string
  physical_country?: string
  facebook_url?: string
  twitter_url?: string
  linkedin_url?: string
  instagram_url?: string
  tax_id?: string
  payment_terms?: string
  credit_limit?: number
  currency?: string
  customer_type?: string
  status?: string
  priority?: string
  notes?: string
  terms?: string
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
    .from("customers")
    .insert({
      company_id: userData.company_id,
      name: formData.name,
      company_name: formData.company_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      website: formData.website || null,
      address_line1: formData.address_line1 || formData.physical_address_line1 || null,
      address_line2: formData.address_line2 || formData.physical_address_line2 || null,
      city: formData.city || formData.physical_city || null,
      state: formData.state || formData.physical_state || null,
      zip: formData.zip || formData.physical_zip || null,
      country: formData.country || formData.physical_country || "USA",
      mailing_address_line1: formData.mailing_address_line1 || null,
      mailing_address_line2: formData.mailing_address_line2 || null,
      mailing_city: formData.mailing_city || null,
      mailing_state: formData.mailing_state || null,
      mailing_zip: formData.mailing_zip || null,
      mailing_country: formData.mailing_country || "USA",
      physical_address_line1: formData.physical_address_line1 || null,
      physical_address_line2: formData.physical_address_line2 || null,
      physical_city: formData.physical_city || null,
      physical_state: formData.physical_state || null,
      physical_zip: formData.physical_zip || null,
      physical_country: formData.physical_country || "USA",
      facebook_url: formData.facebook_url || null,
      twitter_url: formData.twitter_url || null,
      linkedin_url: formData.linkedin_url || null,
      instagram_url: formData.instagram_url || null,
      tax_id: formData.tax_id || null,
      payment_terms: formData.payment_terms || "Net 30",
      credit_limit: formData.credit_limit || null,
      currency: formData.currency || "USD",
      customer_type: formData.customer_type || "shipper",
      status: formData.status || "active",
      priority: formData.priority || "normal",
      notes: formData.notes || null,
      terms: formData.terms || null,
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

  revalidatePath("/dashboard/customers")
  return { data, error: null }
}

// Update customer
export async function updateCustomer(
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
    credit_limit?: number
    currency?: string
    customer_type?: string
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
  if (formData.credit_limit !== undefined) updateData.credit_limit = formData.credit_limit || null
  if (formData.currency !== undefined) updateData.currency = formData.currency || "USD"
  if (formData.customer_type !== undefined) updateData.customer_type = formData.customer_type || "shipper"
  if (formData.status !== undefined) updateData.status = formData.status || "active"
  if (formData.priority !== undefined) updateData.priority = formData.priority || "normal"
  if (formData.notes !== undefined) updateData.notes = formData.notes || null
  if (formData.tags !== undefined) updateData.tags = formData.tags || []
  if (formData.primary_contact_name !== undefined) updateData.primary_contact_name = formData.primary_contact_name || null
  if (formData.primary_contact_email !== undefined) updateData.primary_contact_email = formData.primary_contact_email || null
  if (formData.primary_contact_phone !== undefined) updateData.primary_contact_phone = formData.primary_contact_phone || null

  const { data, error } = await supabase
    .from("customers")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/customers")
  revalidatePath(`/dashboard/customers/${id}`)
  return { data, error: null }
}

// Delete customer
export async function deleteCustomer(id: string) {
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
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/customers")
  return { error: null }
}

// Get customer's loads
export async function getCustomerLoads(customerId: string) {
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

  // Get customer name first
  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .eq("company_id", userData.company_id)
    .single()

  if (!customer) {
    return { error: "Customer not found", data: null }
  }

  // Get loads for this customer (by customer_id or company_name)
  const { data, error } = await supabase
    .from("loads")
    .select("*")
    .eq("company_id", userData.company_id)
    .or(`customer_id.eq.${customerId},company_name.eq.${customer.name}`)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get customer's invoices
export async function getCustomerInvoices(customerId: string) {
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

  // Get customer name first
  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .eq("company_id", userData.company_id)
    .single()

  if (!customer) {
    return { error: "Customer not found", data: null }
  }

  // Get invoices for this customer (by customer_id or customer_name)
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", userData.company_id)
    .or(`customer_id.eq.${customerId},customer_name.eq.${customer.name}`)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get customer's contacts
export async function getCustomerContacts(customerId: string) {
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
    .from("contacts")
    .select("*")
    .eq("company_id", userData.company_id)
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get customer's communication history
export async function getCustomerHistory(customerId: string) {
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
    .from("contact_history")
    .select("*")
    .eq("company_id", userData.company_id)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

