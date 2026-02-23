"use server"

import { createClient } from "@/lib/supabase/server"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found", data: null }
  }

  const { data, error } = await supabase
    .from("company_invoice_taxes")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    return { error: error.message || "Failed to fetch invoice taxes", data: null }
  }

  // Parse JSONB fields
  const taxes = (data || []).map((tax) => ({
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found", data: null }
  }

  // Validate required fields
  if (!tax.name || tax.rate === undefined || !tax.tax_type) {
    return { error: "Name, rate, and tax type are required", data: null }
  }

  // If this is set as default, unset other defaults
  if (tax.is_default) {
    await supabase
      .from("company_invoice_taxes")
      .update({ is_default: false })
      .eq("company_id", userData.company_id)
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("company_invoice_taxes")
    .insert({
      company_id: userData.company_id,
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found", data: null }
  }

  // Verify the tax belongs to the company
  const { data: existing, error: checkError } = await supabase
    .from("company_invoice_taxes")
    .select("company_id")
    .eq("id", id)
    .single()

  if (checkError || !existing || existing.company_id !== userData.company_id) {
    return { error: "Invoice tax not found or access denied", data: null }
  }

  // If setting as default, unset other defaults
  if (tax.is_default === true) {
    await supabase
      .from("company_invoice_taxes")
      .update({ is_default: false })
      .eq("company_id", userData.company_id)
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
    .eq("company_id", userData.company_id)
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found" }
  }

  // Verify the tax belongs to the company
  const { data: existing, error: checkError } = await supabase
    .from("company_invoice_taxes")
    .select("company_id")
    .eq("id", id)
    .single()

  if (checkError || !existing || existing.company_id !== userData.company_id) {
    return { error: "Invoice tax not found or access denied" }
  }

  const { error } = await supabase
    .from("company_invoice_taxes")
    .delete()
    .eq("id", id)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message || "Failed to delete invoice tax" }
  }

  return { error: null }
}

