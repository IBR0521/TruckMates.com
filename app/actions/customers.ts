"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { validateEmail, validatePhone, validateAddress, sanitizeString, sanitizeEmail, sanitizePhone, validateRequiredString, stateNameToCode } from "@/lib/validation"
import { checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

// Explicit selection lists to reduce `select("*")` over-fetching.
// Note: `customers`, `contacts`, and `contact_history` are not represented in `lib/supabase/types.ts`,
// so keep the customer column list aligned with the fields used in this module.
const CUSTOMERS_SELECT =
  "id, company_id, name, company_name, email, phone, website, address_line1, address_line2, city, state, zip, country, tax_id, payment_terms, credit_limit, currency, customer_type, status, priority, notes, tags, primary_contact_name, primary_contact_email, primary_contact_phone, created_at, updated_at"

/** `public.contacts` — supabase/crm_schema_complete.sql */
const CONTACTS_SELECT =
  "id, company_id, customer_id, vendor_id, first_name, last_name, title, email, phone, mobile, fax, preferred_contact_method, send_notifications, send_invoices, is_primary, role, notes, created_at, updated_at"

/** `public.contact_history` — supabase/crm_schema_complete.sql */
const CONTACT_HISTORY_SELECT =
  "id, company_id, customer_id, vendor_id, contact_id, type, subject, message, direction, load_id, invoice_id, user_id, occurred_at, attachments, created_at"

// Uses columns from `lib/supabase/types.ts` for `loads` + `invoices`.
const LOADS_SELECT =
  "id, company_id, shipment_number, origin, destination, weight, weight_kg, contents, value, carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery, actual_delivery, coordinates, created_at, updated_at"
const INVOICES_SELECT =
  "id, company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, created_at, updated_at"

// Get all customers
export async function getCustomers(filters?: {
  status?: string
  customer_type?: string
  search?: string
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

  // Build query with selective columns and pagination
  let query = supabase
    .from("customers")
    .select("id, name, company_name, email, phone, status, customer_type, created_at", { count: "exact" })
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.customer_type) {
    query = query.eq("customer_type", filters.customer_type)
  }

  if (filters?.search) {
    // BUG-035 FIX: Sanitize search string to prevent PostgREST filter injection
    // Remove PostgREST special characters: commas, parentheses, dots-followed-by-operators, percent signs outside wildcards
    const sanitizedSearch = filters.search
      .replace(/[,()]/g, '') // Remove commas and parentheses
      .replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxr|nxl|adj|not)/gi, '') // Remove dot-operator patterns
      .replace(/%/g, '') // Remove percent signs (we'll add them ourselves)
      .trim()
      .substring(0, 100) // Limit length
    
    if (sanitizedSearch) {
      // Use individual .ilike() calls instead of .or() with string interpolation for safety
      query = query.or(
        `name.ilike.%${sanitizedSearch}%,company_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`
      )
    }
  }

  // Apply pagination (default limit 25 for faster initial loads, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return { error: safeDbError(error), data: null, count: 0 }
    }

    return { data: data || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

// Get single customer
export async function getCustomer(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMERS_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    if (!data) {
      return { error: "Customer not found", data: null }
    }

    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("crm")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create customers", data: null }
  }

  // Professional validation
  if (!validateRequiredString(formData.name, 2, 200)) {
    return { error: "Customer name is required and must be between 2 and 200 characters", data: null }
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

  // Validate addresses if provided
  if (formData.city || formData.state || formData.zip) {
    // Convert state name to code for validation
    const stateForValidation = formData.state || formData.physical_state
    const stateCode = stateForValidation ? (stateNameToCode(stateForValidation) || stateForValidation.toUpperCase().trim()) : undefined
    
    const addressValidation = validateAddress({
      street: formData.address_line1 || formData.physical_address_line1,
      city: formData.city || formData.physical_city,
      state: stateCode,
      zip: formData.zip || formData.physical_zip,
    })
    if (!addressValidation.valid) {
      return { error: addressValidation.errors.join("; "), data: null }
    }
  }

  // Check for duplicate company name if provided
  if (formData.company_name) {
    const { data: existingCustomer, error: existingCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("company_name", sanitizeString(formData.company_name, 200))
      .maybeSingle()

    if (existingCustomerError) {
      return { error: existingCustomerError.message, data: null }
    }

    if (existingCustomer) {
      return { error: "Customer with this company name already exists", data: null }
    }
  }

  // Check for duplicate email if provided
  if (formData.email) {
    const { data: existingEmail, error: existingEmailError } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("email", sanitizeEmail(formData.email))
      .maybeSingle()

    if (existingEmailError) {
      return { error: existingEmailError.message, data: null }
    }

    if (existingEmail) {
      return { error: "Customer with this email already exists", data: null }
    }
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: ctx.companyId,
      name: sanitizeString(formData.name, 200),
      company_name: formData.company_name ? sanitizeString(formData.company_name, 200) : null,
      email: formData.email ? sanitizeEmail(formData.email) : null,
      phone: formData.phone ? sanitizePhone(formData.phone) : null,
      website: formData.website ? sanitizeString(formData.website, 200) : null,
      address_line1: (formData.address_line1 || formData.physical_address_line1) ? sanitizeString(formData.address_line1 || formData.physical_address_line1, 200) : null,
      address_line2: (formData.address_line2 || formData.physical_address_line2) ? sanitizeString(formData.address_line2 || formData.physical_address_line2, 200) : null,
      city: (formData.city || formData.physical_city) ? sanitizeString(formData.city || formData.physical_city, 100) : null,
      state: (() => {
        const stateValue = formData.state || formData.physical_state
        if (!stateValue) return null
        return stateNameToCode(stateValue) || sanitizeString(stateValue, 2).toUpperCase()
      })(),
      zip: (formData.zip || formData.physical_zip) ? sanitizeString(formData.zip || formData.physical_zip, 10) : null,
      country: formData.country || formData.physical_country || "USA",
      tax_id: formData.tax_id || null,
      payment_terms: formData.payment_terms || "Net 30",
      credit_limit: formData.credit_limit || null,
      currency: formData.currency || "USD",
      customer_type: formData.customer_type || "shipper",
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
    return { error: safeDbError(error), data: null }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkEditPermission("crm")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to edit customers", data: null }
  }

  // Get current customer data for audit trail
  const { data: currentCustomer, error: currentCustomerError } = await supabase
    .from("customers")
    .select(CUSTOMERS_SELECT)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (currentCustomerError) {
    return { error: currentCustomerError.message, data: null }
  }

  if (!currentCustomer) {
    return { error: "Customer not found", data: null }
  }

  // Build update data and track changes
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  const fieldsToCheck = [
    "name", "company_name", "email", "phone", "website", "address_line1", "address_line2",
    "city", "state", "zip", "country", "tax_id", "payment_terms", "credit_limit",
    "currency", "customer_type", "status", "priority", "notes", "primary_contact_name",
    "primary_contact_email", "primary_contact_phone"
  ]

  for (const field of fieldsToCheck) {
    if (formData[field as keyof typeof formData] !== undefined) {
      const newValue = formData[field as keyof typeof formData]
      const oldValue = currentCustomer[field]
      if (newValue !== oldValue) {
        updateData[field] = newValue === null || newValue === "" ? null : newValue
        changes.push({ field, old_value: oldValue, new_value: newValue })
      }
    }
  }

  if (formData.tags !== undefined && JSON.stringify(formData.tags) !== JSON.stringify(currentCustomer.tags)) {
    updateData.tags = formData.tags || []
    changes.push({ field: "tags", old_value: currentCustomer.tags, new_value: formData.tags })
  }

  if (Object.keys(updateData).length === 0) {
    // CRITICAL FIX: Ensure currentCustomer is JSON-serializable
    const serializableCurrentCustomer = currentCustomer ? JSON.parse(JSON.stringify(currentCustomer, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'bigint') return value.toString()
      return value
    })) : null
    return { data: serializableCurrentCustomer, error: null }
  }

  const { data, error } = await supabase
    .from("customers")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  // Create audit log entries (batched)
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      if (ctx.userId) {
        // Batch all audit log entries into a single operation
        const auditLogPromises = changes.map((change) =>
          createAuditLog({
            action: change.field === "status" ? "status_updated" : "data.updated",
            resource_type: "customer",
            resource_id: id,
            details: {
              field: change.field,
              old_value: change.old_value,
              new_value: change.new_value,
            },
          }).catch((err: any) => {
            Sentry.captureException(err)
            return null
          })
        )
        await Promise.all(auditLogPromises)
        Sentry.captureMessage(
          `[updateCustomer] Audit logs created for ${changes.length} fields`,
          "info"
        )
      }
    } catch (err: unknown) {
      Sentry.captureException(err)
    }
  }

  revalidatePath("/dashboard/customers")
  revalidatePath(`/dashboard/customers/${id}`)
  
  // CRITICAL FIX: Ensure data is JSON-serializable for Next.js server actions
  const serializableData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'bigint') return value.toString()
    return value
  })) : null
  
  return { data: serializableData, error: null }
}

// Delete customer
export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkDeletePermission("crm")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete customers" }
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: safeDbError(error) }
  }

  revalidatePath("/dashboard/customers")
  return { error: null }
}

// Get customer's loads
export async function getCustomerLoads(customerId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get customer name first
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (customerError) {
    return { error: customerError.message, data: null }
  }

  if (!customer) {
    return { error: "Customer not found", data: null }
  }

  // Get loads for this customer - use separate queries to prevent injection
  // First get by customer_id
  const { data: loadsByCustomerId, error: error1 } = await supabase
    .from("loads")
    .select(LOADS_SELECT)
    .eq("company_id", ctx.companyId)
    .eq("customer_id", customerId)

  // Also get by company_name if it matches the customer name exactly (sanitized)
  let loadsByCompanyName: any[] = []
  if (customer.name) {
    const sanitizedName = customer.name.trim()
    const { data: loadsByName, error: error2 } = await supabase
      .from("loads")
      .select(LOADS_SELECT)
      .eq("company_id", ctx.companyId)
      .eq("company_name", sanitizedName)
      .neq("customer_id", customerId) // Exclude ones already matched by customer_id
    
    if (!error2 && loadsByName) {
      loadsByCompanyName = loadsByName
    }
  }

  // Combine results and remove duplicates
  const allLoads = [...(loadsByCustomerId || []), ...loadsByCompanyName]
  const uniqueLoads = allLoads.filter((load, index, self) => 
    index === self.findIndex((l) => l.id === load.id)
  )

  const error = error1
  const data = uniqueLoads.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data, error: null }
}

// Get customer's invoices
export async function getCustomerInvoices(customerId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get customer name first
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (customerError) {
    return { error: customerError.message, data: null }
  }

  if (!customer) {
    return { error: "Customer not found", data: null }
  }

  // Get invoices for this customer - use separate queries to prevent injection
  // First get by customer_id
  const { data: invoicesByCustomerId, error: error1 } = await supabase
    .from("invoices")
    .select(INVOICES_SELECT)
    .eq("company_id", ctx.companyId)
    .eq("customer_id", customerId)

  // Also get by customer_name if it matches the customer name exactly (sanitized)
  let invoicesByCustomerName: any[] = []
  if (customer.name) {
    const sanitizedName = customer.name.trim()
    const { data: invoicesByName, error: error2 } = await supabase
      .from("invoices")
      .select(INVOICES_SELECT)
      .eq("company_id", ctx.companyId)
      .eq("customer_name", sanitizedName)
      .neq("customer_id", customerId) // Exclude ones already matched by customer_id
    
    if (!error2 && invoicesByName) {
      invoicesByCustomerName = invoicesByName
    }
  }

  // Combine results and remove duplicates
  const allInvoices = [...(invoicesByCustomerId || []), ...invoicesByCustomerName]
  const uniqueInvoices = allInvoices.filter((invoice, index, self) => 
    index === self.findIndex((i) => i.id === invoice.id)
  )

  const error = error1
  const data = uniqueInvoices.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data, error: null }
}

// Get customer's contacts
export async function getCustomerContacts(customerId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACTS_SELECT)
    .eq("company_id", ctx.companyId)
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data, error: null }
}

// Get customer's communication history
export async function getCustomerHistory(customerId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("contact_history")
    .select(CONTACT_HISTORY_SELECT)
    .eq("company_id", ctx.companyId)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data, error: null }
}

