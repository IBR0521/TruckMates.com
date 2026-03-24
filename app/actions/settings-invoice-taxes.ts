"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

export interface InvoiceTax {
  id?: string
  name: string
  rate: number // Percentage as decimal (e.g., 0.0825 for 8.25%)
  tax_type: "percentage" | "fixed"
  is_default?: boolean
  is_active?: boolean
  applies_to: "all" | "specific_states" | "specific_customers"
  state_codes?: string[]
  customer_ids?: string[]
  display_order?: number
}

/**
 * Get all invoice taxes for the company
 */
export async function getInvoiceTaxes(): Promise<{ data: InvoiceTax[] | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_invoice_taxes")
    .select(
      "id, company_id, name, rate, tax_type, is_default, is_active, applies_to, state_codes, customer_ids, display_order, created_at, updated_at",
    )
    .eq("company_id", ctx.companyId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    return { error: error.message || "Failed to fetch invoice taxes", data: null }
  }

  // Parse JSONB fields
  const taxes = (data || []).map((tax: { state_codes: string[] | null; customer_ids: string[] | null; [key: string]: any }) => ({
    ...tax,
    state_codes: tax.state_codes || [],
    customer_ids: tax.customer_ids || [],
  }))

  return { data: taxes, error: null }
}

/**
 * Create a new invoice tax
 */
export async function createInvoiceTax(tax: Omit<InvoiceTax, "id">): Promise<{ data: InvoiceTax | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can create invoice taxes", data: null }
  }

  // Validate required fields
  if (!tax.name || tax.rate === undefined || !tax.tax_type) {
    return { error: "Name, rate, and tax type are required", data: null }
  }

  // LOW FIX 18: Validate rate bounds
  if (tax.rate < 0) {
    return { error: "Tax rate cannot be negative", data: null }
  }
  if (tax.tax_type === "percentage" && tax.rate > 1) {
    return { error: "Percentage tax rate cannot exceed 1.0 (100%)", data: null }
  }
  if (tax.tax_type === "fixed" && tax.rate > 10000) {
    return { error: "Fixed tax rate cannot exceed $10,000", data: null }
  }

  // If this is set as default, unset other defaults
  if (tax.is_default) {
    await supabase
      .from("company_invoice_taxes")
      .update({ is_default: false })
      .eq("company_id", ctx.companyId)
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("company_invoice_taxes")
    .insert({
      company_id: ctx.companyId,
      name: tax.name.trim(),
      rate: tax.rate,
      tax_type: tax.tax_type,
      is_default: tax.is_default || false,
      is_active: tax.is_active !== false,
      applies_to: tax.applies_to || "all",
      state_codes: tax.state_codes || [],
      customer_ids: tax.customer_ids || [],
      display_order: tax.display_order || 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A tax with this name already exists", data: null }
    }
    return { error: error.message || "Failed to create invoice tax", data: null }
  }

  return { data: { ...data, state_codes: data.state_codes || [], customer_ids: data.customer_ids || [] }, error: null }
}

/**
 * Update an invoice tax
 */
export async function updateInvoiceTax(id: string, tax: Partial<InvoiceTax>): Promise<{ data: InvoiceTax | null; error: string | null }> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Verify the tax belongs to the company
  const { data: existing, error: checkError } = await supabase
    .from("company_invoice_taxes")
    .select("company_id")
    .eq("id", id)
    .maybeSingle()

  if (checkError || !existing || existing.company_id !== ctx.companyId) {
    return { error: "Invoice tax not found or access denied", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update invoice taxes", data: null }
  }

  // LOW FIX 18: Validate rate bounds
  if (tax.rate !== undefined) {
    if (tax.rate < 0) {
      return { error: "Tax rate cannot be negative", data: null }
    }
    if (tax.tax_type === "percentage" && tax.rate > 1) {
      return { error: "Percentage tax rate cannot exceed 1.0 (100%)", data: null }
    }
    if (tax.tax_type === "fixed" && tax.rate > 10000) {
      return { error: "Fixed tax rate cannot exceed $10,000", data: null }
    }
  }

  // If setting as default, unset other defaults
  if (tax.is_default === true) {
    await supabase
      .from("company_invoice_taxes")
      .update({ is_default: false })
      .eq("company_id", ctx.companyId)
      .eq("is_default", true)
      .neq("id", id)
  }

  const updateData: any = {}
  if (tax.name !== undefined) updateData.name = tax.name.trim()
  if (tax.rate !== undefined) updateData.rate = tax.rate
  if (tax.tax_type !== undefined) updateData.tax_type = tax.tax_type
  if (tax.is_default !== undefined) updateData.is_default = tax.is_default
  if (tax.is_active !== undefined) updateData.is_active = tax.is_active
  if (tax.applies_to !== undefined) updateData.applies_to = tax.applies_to
  if (tax.state_codes !== undefined) updateData.state_codes = tax.state_codes || []
  if (tax.customer_ids !== undefined) updateData.customer_ids = tax.customer_ids || []
  if (tax.display_order !== undefined) updateData.display_order = tax.display_order

  const { data, error } = await supabase
    .from("company_invoice_taxes")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A tax with this name already exists", data: null }
    }
    return { error: error.message || "Failed to update invoice tax", data: null }
  }

  return { data: { ...data, state_codes: data.state_codes || [], customer_ids: data.customer_ids || [] }, error: null }
}

/**
 * Delete an invoice tax
 */
export async function deleteInvoiceTax(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can delete invoice taxes" }
  }

  // Verify the tax belongs to the company
  const { data: existing, error: checkError } = await supabase
    .from("company_invoice_taxes")
    .select("company_id")
    .eq("id", id)
    .maybeSingle()

  if (checkError || !existing || existing.company_id !== ctx.companyId) {
    return { error: "Invoice tax not found or access denied" }
  }

  const { error } = await supabase
    .from("company_invoice_taxes")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message || "Failed to delete invoice tax" }
  }

  return { error: null }
}







