"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getBillingInfo() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  const { data, error } = await supabase
    .from("company_billing_info")
    .select("*")
    .eq("company_id", result.company_id)
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", success: false }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", success: false }
  }

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
      .update(billing)
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
        ...billing,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings/billing")
  return { success: true, error: null }
}








