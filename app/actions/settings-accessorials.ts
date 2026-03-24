"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

export interface Accessorial {
  id?: string
  name: string
  code?: string
  description?: string
  default_amount?: number
  charge_type: "flat" | "per_hour" | "per_day" | "percentage"
  is_taxable?: boolean
  is_active?: boolean
  is_default?: boolean
  category?: "pickup" | "delivery" | "transit" | "other"
  display_order?: number
}

/**
 * Get all accessorials for the company
 */
export async function getAccessorials(): Promise<{ data: Accessorial[] | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_accessorials")
    .select(
      "id, company_id, name, code, description, default_amount, charge_type, is_taxable, is_active, is_default, category, display_order, created_at, updated_at",
    )
    .eq("company_id", ctx.companyId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    return { error: error.message || "Failed to fetch accessorials", data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Create a new accessorial
 */
export async function createAccessorial(accessorial: Omit<Accessorial, "id">): Promise<{ data: Accessorial | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // HIGH FIX 1: Add RBAC check - only managers can create accessorials
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
    return { error: "Only managers can create accessorials", data: null }
  }

  // Validate required fields
  if (!accessorial.name || !accessorial.charge_type) {
    return { error: "Name and charge type are required", data: null }
  }

  const { data, error } = await supabase
    .from("company_accessorials")
    .insert({
      company_id: ctx.companyId,
      name: accessorial.name.trim(),
      code: accessorial.code?.trim() || null,
      description: accessorial.description?.trim() || null,
      default_amount: accessorial.default_amount || null,
      charge_type: accessorial.charge_type,
      is_taxable: accessorial.is_taxable || false,
      is_active: accessorial.is_active !== false,
      is_default: accessorial.is_default || false,
      category: accessorial.category || null,
      display_order: accessorial.display_order || 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "An accessorial with this name already exists", data: null }
    }
    return { error: error.message || "Failed to create accessorial", data: null }
  }

  return { data, error: null }
}

/**
 * Update an accessorial
 */
export async function updateAccessorial(id: string, accessorial: Partial<Accessorial>): Promise<{ data: Accessorial | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // HIGH FIX 1: Add RBAC check - only managers can update accessorials
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", ctx.userId)
    .maybeSingle()

  if (userError || !userData) {
    return { error: userError?.message || "No company found", data: null }
  }

  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!MANAGER_ROLES.includes(userData.role)) {
    return { error: "Only managers can update accessorials", data: null }
  }

  // Verify the accessorial belongs to the company
  const { data: existing, error: checkError } = await supabase
    .from("company_accessorials")
    .select("company_id")
    .eq("id", id)
    .maybeSingle()

  if (checkError || !existing || existing.company_id !== ctx.companyId) {
    return { error: "Accessorial not found or access denied", data: null }
  }

  const updateData: any = {}
  if (accessorial.name !== undefined) updateData.name = accessorial.name.trim()
  if (accessorial.code !== undefined) updateData.code = accessorial.code?.trim() || null
  if (accessorial.description !== undefined) updateData.description = accessorial.description?.trim() || null
  if (accessorial.default_amount !== undefined) updateData.default_amount = accessorial.default_amount || null
  if (accessorial.charge_type !== undefined) updateData.charge_type = accessorial.charge_type
  if (accessorial.is_taxable !== undefined) updateData.is_taxable = accessorial.is_taxable
  if (accessorial.is_active !== undefined) updateData.is_active = accessorial.is_active
  if (accessorial.is_default !== undefined) updateData.is_default = accessorial.is_default
  if (accessorial.category !== undefined) updateData.category = accessorial.category || null
  if (accessorial.display_order !== undefined) updateData.display_order = accessorial.display_order

  const { data, error } = await supabase
    .from("company_accessorials")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "An accessorial with this name already exists", data: null }
    }
    return { error: error.message || "Failed to update accessorial", data: null }
  }

  return { data, error: null }
}

/**
 * Delete an accessorial
 */
export async function deleteAccessorial(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // HIGH FIX 1: Add RBAC check - only managers can delete accessorials
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
    return { error: "Only managers can delete accessorials" }
  }

  // Verify the accessorial belongs to the company
  const { data: existing, error: checkError } = await supabase
    .from("company_accessorials")
    .select("company_id")
    .eq("id", id)
    .maybeSingle()

  if (checkError || !existing || existing.company_id !== ctx.companyId) {
    return { error: "Accessorial not found or access denied" }
  }

  const { error } = await supabase
    .from("company_accessorials")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message || "Failed to delete accessorial" }
  }

  return { error: null }
}







