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

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found", data: null }
  }

  try {
    // Generate a unique EIN number (format: XX-XXXXXXX)
    let newEIN: string
    let exists = true
    let attempts = 0
    const maxAttempts = 10

    while (exists && attempts < maxAttempts) {
      // Generate EIN: XX-XXXXXXX format (9 digits total)
      const prefix = Math.floor(Math.random() * 90 + 10).toString().padStart(2, '0')
      const suffix = Math.floor(Math.random() * 9999999 + 1).toString().padStart(7, '0')
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

    // Save the generated EIN to the database
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
    await supabase
      .from("company_settings")
      .update({ ein_number: newEIN })
      .eq("company_id", userData.company_id)

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

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: userError?.message || "No company found" }
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

