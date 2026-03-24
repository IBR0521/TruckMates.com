"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * Get subscription information
 */
export async function getSubscription(): Promise<{ data: any | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("id, company_id, plan_name, plan_display_name, status, billing_cycle, amount, currency, start_date, end_date, trial_end_date, cancelled_at, auto_renew, features")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    return { error: error.message || "Failed to fetch subscription", data: null }
  }

  // Platform is free - return default free subscription if none exists
  if (!data) {
    return { 
      data: {
        plan_name: "free",
        plan_display_name: "Free",
        status: "active",
        billing_cycle: "monthly",
        amount: 0,
        currency: "USD",
        auto_renew: false,
        features: {},
      }, 
      error: null 
    }
  }

  return { data, error: null }
}

/**
 * Get payment history
 */
export async function getPaymentHistory(): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_payment_history")
    .select("id, company_id, subscription_id, amount, currency, payment_method, payment_method_last4, transaction_id, status, status_message, payment_date, processed_at, invoice_number, receipt_url, metadata, created_at, updated_at")
    .eq("company_id", ctx.companyId)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_payment_methods")
    .select("id, company_id, type, is_default, card_brand, card_last4, card_exp_month, card_exp_year, cardholder_name, bank_name, account_type, account_last4, routing_number, external_id, is_active, created_at, updated_at")
    .eq("company_id", ctx.companyId)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // HIGH FIX 1: Add RBAC check - only managers can save payment methods
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", ctx.userId)
    .maybeSingle()

  if (userError || !userData) {
    return { error: userError?.message || "No company found", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can save payment methods", data: null }
  }

  // MEDIUM FIX: Use atomic RPC function to prevent TOCTOU race condition
  if (paymentMethod.is_default) {
    // Use RPC function for atomic default swap
    const { error: rpcError } = await supabase.rpc("set_payment_method_default", {
      p_company_id: ctx.companyId,
      p_payment_method_id: paymentMethod.id || "", // Will be set after insert
      p_is_default: true,
    })
    
    if (rpcError && !paymentMethod.id) {
      // If this is a new payment method, we'll set default after insert
      // For existing, RPC should work
      Sentry.captureMessage(
        `[savePaymentMethod] RPC failed, will set default after insert: ${rpcError.message}`,
        "warning",
      )
    }
  }

  if (paymentMethod.id) {
    // Update existing (don't set is_default here, use RPC if needed)
    const updateData: any = {
      type: paymentMethod.type,
      card_brand: paymentMethod.card_brand || null,
      card_last4: paymentMethod.card_last4 || null,
      card_exp_month: paymentMethod.card_exp_month || null,
      card_exp_year: paymentMethod.card_exp_year || null,
      cardholder_name: paymentMethod.cardholder_name || null,
      bank_name: paymentMethod.bank_name || null,
      account_type: paymentMethod.account_type || null,
      account_last4: paymentMethod.account_last4 || null,
      external_id: paymentMethod.external_id || null,
    }
    
    // Only set is_default if not using RPC (fallback)
    if (paymentMethod.is_default) {
      // Try RPC first for atomic swap
      const { error: rpcError } = await supabase.rpc("set_payment_method_default", {
        p_company_id: ctx.companyId,
        p_payment_method_id: paymentMethod.id,
        p_is_default: true,
      })
      
      if (rpcError) {
        // Fallback to non-atomic update if RPC fails
        updateData.is_default = true
        const { error: unsetError } = await supabase
          .from("company_payment_methods")
          .update({ is_default: false })
          .eq("company_id", ctx.companyId)
          .eq("is_default", true)
          .neq("id", paymentMethod.id)
      }
    } else {
      updateData.is_default = false
    }
    
    const { data, error } = await supabase
      .from("company_payment_methods")
      .update(updateData)
      .eq("id", paymentMethod.id)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: error.message || "Failed to update payment method", data: null }
    }

    return { data, error: null }
  } else {
    // Create new (don't set is_default on insert, use RPC after)
    const { data, error } = await supabase
      .from("company_payment_methods")
      .insert({
        company_id: ctx.companyId,
        type: paymentMethod.type,
        card_brand: paymentMethod.card_brand || null,
        card_last4: paymentMethod.card_last4 || null,
        card_exp_month: paymentMethod.card_exp_month || null,
        card_exp_year: paymentMethod.card_exp_year || null,
        cardholder_name: paymentMethod.cardholder_name || null,
        bank_name: paymentMethod.bank_name || null,
        account_type: paymentMethod.account_type || null,
        account_last4: paymentMethod.account_last4 || null,
        external_id: paymentMethod.external_id || null,
        is_default: false, // Set via RPC after insert
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message || "Failed to create payment method", data: null }
    }

    // If this should be default, use RPC to atomically set it
    if (paymentMethod.is_default && data?.id) {
      await supabase.rpc("set_payment_method_default", {
        p_company_id: ctx.companyId,
        p_payment_method_id: data.id,
        p_is_default: true,
      })
    }

    return { data, error: null }
  }
}

/**
 * Delete payment method
 */
export async function deletePaymentMethod(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // HIGH FIX 1: Add RBAC check - only managers can delete payment methods
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", ctx.userId)
    .maybeSingle()

  if (userError || !userData) {
    return { error: userError?.message || "No company found" }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can delete payment methods" }
  }

  // MEDIUM FIX 15: Check if this is the default or only payment method
  const { data: paymentMethod, error: paymentMethodError } = await supabase
    .from("company_payment_methods")
    .select("id, is_default, is_active")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (paymentMethodError) {
    return { error: paymentMethodError.message || "Failed to fetch payment method" }
  }

  if (!paymentMethod) {
    return { error: "Payment method not found" }
  }

  // Check if this is the only active payment method
  const { data: allMethods } = await supabase
    .from("company_payment_methods")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("is_active", true)

  if (allMethods && allMethods.length === 1 && allMethods[0].id === id) {
    return { error: "Cannot delete the only active payment method. Please add another payment method first." }
  }

  // Check if this is the default payment method
  if (paymentMethod.is_default) {
    // Find another active payment method to set as default
    const { data: otherMethod, error: otherMethodError } = await supabase
      .from("company_payment_methods")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("is_active", true)
      .neq("id", id)
      .limit(1)
      .maybeSingle()

    if (otherMethodError) {
      return { error: otherMethodError.message || "Failed to find fallback payment method" }
    }

    if (otherMethod) {
      // Set another method as default before deleting
      await supabase
        .from("company_payment_methods")
        .update({ is_default: true })
        .eq("id", otherMethod.id)
        .eq("company_id", ctx.companyId)
    } else {
      return { error: "Cannot delete the default payment method. Please set another payment method as default first." }
    }
  }

  const { error } = await supabase
    .from("company_payment_methods")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message || "Failed to delete payment method" }
  }

  return { error: null }
}







