"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Saved Filter Presets
 * Allows users to save and reuse filter configurations
 */

export interface FilterPreset {
  id?: string
  name: string
  page: string // 'loads', 'drivers', 'trucks', 'routes', etc.
  filters: Record<string, any> // Filter configuration
  is_default?: boolean
}

/**
 * Get all saved filter presets for a page
 */
export async function getFilterPresets(page: string) {
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

  // Check if table exists
  const { data, error } = await supabase
    .from("filter_presets")
    .select("*")
    .eq("company_id", result.company_id)
    .eq("page", page)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    // Table might not exist - return empty array
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return { data: [], error: null }
    }
    return { error: error.message, data: null }
  }

  return { data: data || [], error: null }
}

/**
 * Save a filter preset
 */
export async function saveFilterPreset(preset: FilterPreset) {
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

  // If this is set as default, unset other defaults for this page
  if (preset.is_default) {
    await supabase
      .from("filter_presets")
      .update({ is_default: false })
      .eq("company_id", result.company_id)
      .eq("page", preset.page)
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("filter_presets")
    .insert({
      company_id: result.company_id,
      user_id: user.id,
      name: preset.name,
      page: preset.page,
      filters: preset.filters,
      is_default: preset.is_default || false,
    })
    .select()
    .single()

  if (error) {
    // Table might not exist
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return { error: "Filter presets table does not exist. Please run the SQL schema.", data: null }
    }
    return { error: error.message, data: null }
  }

  revalidatePath(`/dashboard/${preset.page}`)
  return { data, error: null }
}

/**
 * Update a filter preset
 */
export async function updateFilterPreset(id: string, preset: Partial<FilterPreset>) {
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

  // If this is set as default, unset other defaults for this page
  if (preset.is_default) {
    await supabase
      .from("filter_presets")
      .update({ is_default: false })
      .eq("company_id", result.company_id)
      .eq("page", preset.page || "")
      .eq("is_default", true)
      .neq("id", id)
  }

  const updateData: any = {}
  if (preset.name) updateData.name = preset.name
  if (preset.filters) updateData.filters = preset.filters
  if (preset.is_default !== undefined) updateData.is_default = preset.is_default

  const { data, error } = await supabase
    .from("filter_presets")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath(`/dashboard/${preset.page || ""}`)
  return { data, error: null }
}

/**
 * Delete a filter preset
 */
export async function deleteFilterPreset(id: string) {
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

  // Get preset to know which page to revalidate
  const { data: preset } = await supabase
    .from("filter_presets")
    .select("page")
    .eq("id", id)
    .eq("company_id", result.company_id)
    .single()

  const { error } = await supabase
    .from("filter_presets")
    .delete()
    .eq("id", id)
    .eq("company_id", result.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  if (preset) {
    revalidatePath(`/dashboard/${preset.page}`)
  }

  return { data: { deleted: true }, error: null }
}

/**
 * Get default filter preset for a page
 */
export async function getDefaultFilterPreset(page: string) {
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
    .from("filter_presets")
    .select("*")
    .eq("company_id", result.company_id)
    .eq("page", page)
    .eq("is_default", true)
    .single()

  if (error) {
    if (error.code === "PGRST116" || error.code === "42P01") {
      return { data: null, error: null } // No default preset or table doesn't exist
    }
    return { error: error.message, data: null }
  }

  return { data, error: null }
}







