"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"

/**
 * V3-003 FIX: Remove fake EIN generation - EINs are issued by the IRS, not generated randomly
 * This function is deprecated. Users must enter their real IRS-issued EIN.
 * 
 * @deprecated This function generates fake EINs which is illegal if used on tax filings.
 * Use updateEIN() instead to save a user-entered real IRS EIN.
 */
export async function generateEIN(): Promise<{ data: { ein: string; id: string } | null; error: string | null }> {
  // V3-003 FIX: Return error - fake EIN generation is illegal
  return { 
    error: "EIN generation has been removed. EINs are issued by the IRS and cannot be generated. Please enter your real IRS-issued EIN in the EIN field.", 
    data: null 
  }
}

/**
 * Update/save EIN number for the company
 * V3-003 FIX: Users must enter their real IRS-issued EIN
 */
export async function updateEIN(einNumber: string): Promise<{ data: { ein: string } | null; error: string | null }> {
  // V3-003 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can update EIN numbers", data: null }
    }

    // V3-003 FIX: Validate EIN format (XX-XXXXXXX)
    const einRegex = /^\d{2}-\d{7}$/
    const cleanedEIN = einNumber.trim().replace(/\s+/g, "")
    
    if (!einRegex.test(cleanedEIN)) {
      return { 
        error: "Invalid EIN format. EIN must be in format XX-XXXXXXX (e.g., 12-3456789). Please enter your real IRS-issued EIN.", 
        data: null 
      }
    }

    // Update company_settings with the EIN
    const { error: updateError } = await supabase
      .from("company_settings")
      .update({ ein_number: cleanedEIN })
      .eq("company_id", ctx.companyId)

    if (updateError) {
      return { error: updateError.message || "Failed to update EIN", data: null }
    }

    return {
      data: {
        ein: cleanedEIN,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

/**
 * Get all EIN numbers for the company
 */
export async function getEINNumbers(): Promise<{ data: any[] | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_ein_numbers")
    .select("id, company_id, ein, created_at, updated_at")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message || "Failed to fetch EIN numbers", data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Delete an EIN number
 */
export async function deleteEINNumber(einId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated" }
  }

  // HIGH FIX 1: Add RBAC check - only managers can delete EINs
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", ctx.userId)
    .single()

  if (userError) {
    return { error: userError?.message || "No company found" }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can delete EIN numbers" }
  }

  // Verify the EIN belongs to the company
  const { data: einData, error: checkError } = await supabase
    .from("company_ein_numbers")
    .select("company_id")
    .eq("id", einId)
    .single()

  if (checkError || !einData || einData.company_id !== ctx.companyId) {
    return { error: "EIN number not found or access denied" }
  }

  const { error } = await supabase
    .from("company_ein_numbers")
    .delete()
    .eq("id", einId)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: error.message || "Failed to delete EIN number" }
  }

  return { error: null }
}

