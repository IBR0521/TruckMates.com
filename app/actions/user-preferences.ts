"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Get user preferences
 */
export async function getUserPreferences() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  let { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error && error.code === 'PGRST116') {
    // Preferences don't exist, create defaults
    const { data: newPrefs, error: createError } = await supabase
      .from("user_preferences")
      .insert({
        user_id: user.id,
      })
      .select()
      .single()

    if (createError) {
      return { error: createError.message, data: null }
    }

    data = newPrefs
  } else if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(preferences: {
  dashboard_layout?: any
  default_view?: string
  table_columns?: any
  table_sorting?: any
  table_filters?: any
  theme?: string
  compact_mode?: boolean
  sidebar_collapsed?: boolean
  desktop_notifications?: boolean
  sound_enabled?: boolean
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Get or create preferences
  const prefsResult = await getUserPreferences()
  if (prefsResult.error && !prefsResult.error.includes("PGRST116")) {
    return prefsResult
  }

  let data, error

  if (prefsResult.data) {
    // Update existing
    const { data: updated, error: updateError } = await supabase
      .from("user_preferences")
      .update(preferences)
      .eq("user_id", user.id)
      .select()
      .single()

    data = updated
    error = updateError
  } else {
    // Create new
    const { data: created, error: createError } = await supabase
      .from("user_preferences")
      .insert({
        user_id: user.id,
        ...preferences,
      })
      .select()
      .single()

    data = created
    error = createError
  }

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings")
  return { data, error: null }
}










