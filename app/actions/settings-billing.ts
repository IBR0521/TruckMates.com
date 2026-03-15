"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"

export async function getBillingInfo() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_billing_info")
    .select("*")
    .eq("company_id", ctx.companyId)
    .single()

  if (error && error.code !== "PGRST116") {
    return { error: error.message, data: null }
  }

  // Return defaults if no billing info exists
  if (!data) {
    return {
      data: {
        billing_company_name: "",
        billing_email: "",
        billing_phone: "",
        billing_address: "",
        tax_id: "",
        tax_exempt: false,
        payment_method: "card",
        payment_terms: "Net 30",
        billing_notes: "",
      },
      error: null,
    }
  }

  return { data, error: null }
}

export async function updateBillingInfo(billing: {
  billing_company_name?: string
  billing_email?: string
  billing_phone?: string
  billing_address?: string
  tax_id?: string
  tax_exempt?: boolean
  payment_method?: string
  payment_terms?: string
  billing_notes?: string
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", success: false }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update billing information", success: false }
  }

  const result = { company_id: ctx.companyId }

  // MEDIUM FIX 17: Build explicit updateData object to prevent column injection
  const updateData: any = {}
  if (billing.billing_company_name !== undefined) updateData.billing_company_name = billing.billing_company_name
  if (billing.billing_email !== undefined) updateData.billing_email = billing.billing_email
  if (billing.billing_phone !== undefined) updateData.billing_phone = billing.billing_phone
  if (billing.billing_address !== undefined) updateData.billing_address = billing.billing_address
  if (billing.tax_id !== undefined) updateData.tax_id = billing.tax_id
  if (billing.tax_exempt !== undefined) updateData.tax_exempt = billing.tax_exempt
  if (billing.payment_method !== undefined) updateData.payment_method = billing.payment_method
  if (billing.payment_terms !== undefined) updateData.payment_terms = billing.payment_terms
  if (billing.billing_notes !== undefined) updateData.billing_notes = billing.billing_notes

  // Check if billing info exists
  const { data: existing } = await supabase
    .from("company_billing_info")
    .select("id")
    .eq("company_id", result.company_id)
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("company_billing_info")
      .update(updateData)
      .eq("company_id", result.company_id)

    if (error) {
      return { error: error.message, success: false }
    }
  } else {
    // Create new
    const { error } = await supabase
      .from("company_billing_info")
      .insert({
        company_id: result.company_id,
        ...updateData,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings/billing")
  return { success: true, error: null }
}












