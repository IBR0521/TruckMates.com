"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get subscription information
 */
export async function getSubscription(): Promise<{ data: any | null; error: string | null }> {
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
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", userData.company_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { error: error.message || "Failed to fetch subscription", data: null }
  }

  return { data: data || null, error: null }
}

/**
 * Get payment history
 */
export async function getPaymentHistory(): Promise<{ data: any[] | null; error: string | null }> {
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
    .from("company_payment_history")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("payment_date", { ascending: false })
    .limit(50)

  if (error) {
    return { error: error.message || "Failed to fetch payment history", data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Get payment methods
 */
export async function getPaymentMethods(): Promise<{ data: any[] | null; error: string | null }> {
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
    .from("company_payment_methods")
    .select("*")
    .eq("company_id", userData.company_id)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message || "Failed to fetch payment methods", data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Create or update payment method
 */
export async function savePaymentMethod(paymentMethod: {
  type: "card" | "ach" | "wire" | "check"
  card_brand?: string
  card_last4?: string
  card_exp_month?: number
  card_exp_year?: number
  cardholder_name?: string
  bank_name?: string
  account_type?: string
  account_last4?: string
  routing_number?: string
  external_id?: string
  is_default?: boolean
  id?: string
}): Promise<{ data: any | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // HIGH FIX 1: Add RBAC check - only managers can save payment methods
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found", data: null }
  }

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!MANAGER_ROLES.includes(userData.role)) {
    return { error: "Only managers can save payment methods", data: null }
  }

  // MEDIUM FIX 14: Use atomic RPC or single transaction to prevent TOCTOU race condition
  // For now, we'll use a single upsert with conflict handling
  // TODO: Create RPC function for atomic default payment method swap
  if (paymentMethod.is_default) {
    // Use a single query to unset all and set this one as default atomically
    // This is still not fully atomic but reduces the race window
    const { error: unsetError } = await supabase
      .from("company_payment_methods")
      .update({ is_default: false })
      .eq("company_id", userData.company_id)
      .eq("is_default", true)
    
    if (unsetError) {
      console.error("[savePaymentMethod] Failed to unset defaults:", unsetError)
      // Continue anyway - the insert/update will still set is_default
    }
  }

  if (paymentMethod.id) {
    // Update existing
    const { data, error } = await supabase
      .from("company_payment_methods")
      .update({
        type: paymentMethod.type,
        card_brand: paymentMethod.card_brand || null,
        card_last4: paymentMethod.card_last4 || null,
        card_exp_month: paymentMethod.card_exp_month || null,
        card_exp_year: paymentMethod.card_exp_year || null,
        cardholder_name: paymentMethod.cardholder_name || null,
        bank_name: paymentMethod.bank_name || null,
        account_type: paymentMethod.account_type || null,
        account_last4: paymentMethod.account_last4 || null,
        // HIGH FIX 6: Never store routing numbers in plain text - use external_id (tokenized) only
        // routing_number: paymentMethod.routing_number || null, // REMOVED - PCI DSS violation
        external_id: paymentMethod.external_id || null,
        is_default: paymentMethod.is_default || false,
      })
      .eq("id", paymentMethod.id)
      .eq("company_id", userData.company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message || "Failed to update payment method", data: null }
    }

    return { data, error: null }
  } else {
    // Create new
    const { data, error } = await supabase
      .from("company_payment_methods")
      .insert({
        company_id: userData.company_id,
        type: paymentMethod.type,
        card_brand: paymentMethod.card_brand || null,
        card_last4: paymentMethod.card_last4 || null,
        card_exp_month: paymentMethod.card_exp_month || null,
        card_exp_year: paymentMethod.card_exp_year || null,
        cardholder_name: paymentMethod.cardholder_name || null,
        bank_name: paymentMethod.bank_name || null,
        account_type: paymentMethod.account_type || null,
        account_last4: paymentMethod.account_last4 || null,
        // HIGH FIX 6: Never store routing numbers in plain text - use external_id (tokenized) only
        // routing_number: paymentMethod.routing_number || null, // REMOVED - PCI DSS violation
        external_id: paymentMethod.external_id || null,
        is_default: paymentMethod.is_default || false,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message || "Failed to create payment method", data: null }
    }

    return { data, error: null }
  }
}

/**
 * Delete payment method
 */
export async function deletePaymentMethod(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // HIGH FIX 1: Add RBAC check - only managers can delete payment methods
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found" }
  }

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!MANAGER_ROLES.includes(userData.role)) {
    return { error: "Only managers can delete payment methods" }
  }

  // MEDIUM FIX 15: Check if this is the default or only payment method
  const { data: paymentMethod } = await supabase
    .from("company_payment_methods")
    .select("id, is_default, is_active")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (!paymentMethod) {
    return { error: "Payment method not found" }
  }

  // Check if this is the only active payment method
  const { data: allMethods } = await supabase
    .from("company_payment_methods")
    .select("id")
    .eq("company_id", userData.company_id)
    .eq("is_active", true)

  if (allMethods && allMethods.length === 1 && allMethods[0].id === id) {
    return { error: "Cannot delete the only active payment method. Please add another payment method first." }
  }

  // Check if this is the default payment method
  if (paymentMethod.is_default) {
    // Find another active payment method to set as default
    const { data: otherMethod } = await supabase
      .from("company_payment_methods")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("is_active", true)
      .neq("id", id)
      .limit(1)
      .single()

    if (otherMethod) {
      // Set another method as default before deleting
      await supabase
        .from("company_payment_methods")
        .update({ is_default: true })
        .eq("id", otherMethod.id)
        .eq("company_id", userData.company_id)
    } else {
      return { error: "Cannot delete the default payment method. Please set another payment method as default first." }
    }
  }

  const { error } = await supabase
    .from("company_payment_methods")
    .delete()
    .eq("id", id)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message || "Failed to delete payment method" }
  }

  return { error: null }
}







