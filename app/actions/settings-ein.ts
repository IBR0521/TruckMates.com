"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Generate a new EIN number for the company
 */
export async function generateEIN(): Promise<{ data: { ein: string; id: string } | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // HIGH FIX 1: Add RBAC check - only managers can generate EINs
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
    return { error: "Only managers can generate EIN numbers", data: null }
  }

  // MEDIUM FIX 12: Check if company already has an active EIN
  const { data: existingEIN } = await supabase
    .from("company_settings")
    .select("ein_number")
    .eq("company_id", userData.company_id)
    .single()

  if (existingEIN?.ein_number) {
    return { error: "Company already has an active EIN. Please delete the existing EIN before generating a new one.", data: null }
  }

  try {
    // Generate a unique EIN number (format: XX-XXXXXXX)
    let newEIN: string
    let exists = true
    let attempts = 0
    const maxAttempts = 10

    while (exists && attempts < maxAttempts) {
      // MEDIUM FIX 11: Use crypto.randomInt() instead of Math.random() for cryptographically secure EIN generation
      const cryptoModule = await import("crypto")
      const prefix = cryptoModule.randomInt(10, 99).toString().padStart(2, '0')
      const suffix = cryptoModule.randomInt(1000000, 9999999).toString().padStart(7, '0')
      newEIN = `${prefix}-${suffix}`

      // Check if EIN already exists
      const { data: existing } = await supabase
        .from("company_ein_numbers")
        .select("id")
        .eq("ein_number", newEIN)
        .single()

      exists = !!existing
      attempts++
    }

    if (exists) {
      return { error: "Failed to generate unique EIN after multiple attempts", data: null }
    }

    // MEDIUM FIX: Use atomic RPC function for EIN creation
    // Try RPC first, fallback to manual if RPC doesn't exist
    let einId: string
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc("create_ein_atomic", {
        p_company_id: userData.company_id,
        p_ein_number: newEIN,
        p_generated_by: user.id,
      })

      if (!rpcError && rpcResult) {
        einId = typeof rpcResult === 'string' ? rpcResult : String(rpcResult)
        
        return {
          data: {
            ein: newEIN,
            id: einId,
          },
          error: null,
        }
      }
    } catch (error) {
      // RPC function doesn't exist, use fallback
      console.warn("[generateEIN] RPC function not available, using fallback")
    }

    // Fallback: Manual two-step with rollback (not fully atomic but better than before)
    const { data: savedEIN, error: saveError } = await supabase
      .from("company_ein_numbers")
      .insert({
        company_id: userData.company_id,
        ein_number: newEIN,
        generated_by: user.id,
      })
      .select("id, ein_number")
      .single()

    if (saveError) {
      return { error: saveError.message || "Failed to save EIN", data: null }
    }

    // Update company_settings with the EIN
    const { error: updateError } = await supabase
      .from("company_settings")
      .update({ ein_number: newEIN })
      .eq("company_id", userData.company_id)

    // If update fails, delete the EIN record to prevent orphan
    if (updateError) {
      // Rollback: delete the EIN record we just created
      await supabase
        .from("company_ein_numbers")
        .delete()
        .eq("id", savedEIN.id)
      
      return { error: updateError.message || "Failed to update company settings with EIN", data: null }
    }

    return {
      data: {
        ein: savedEIN.ein_number,
        id: savedEIN.id,
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[generateEIN] Error:", error)
    return { error: error.message || "Failed to generate EIN", data: null }
  }
}

/**
 * Get all EIN numbers for the company
 */
export async function getEINNumbers(): Promise<{ data: any[] | null; error: string | null }> {
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
    .from("company_ein_numbers")
    .select("*")
    .eq("company_id", userData.company_id)
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // HIGH FIX 1: Add RBAC check - only managers can delete EINs
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
    return { error: "Only managers can delete EIN numbers" }
  }

  // Verify the EIN belongs to the company
  const { data: einData, error: checkError } = await supabase
    .from("company_ein_numbers")
    .select("company_id")
    .eq("id", einId)
    .single()

  if (checkError || !einData || einData.company_id !== userData.company_id) {
    return { error: "EIN number not found or access denied" }
  }

  const { error } = await supabase
    .from("company_ein_numbers")
    .delete()
    .eq("id", einId)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message || "Failed to delete EIN number" }
  }

  return { error: null }
}

