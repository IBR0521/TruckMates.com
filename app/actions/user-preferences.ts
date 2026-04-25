"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Get user preferences
 */
export async function getUserPreferences() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  let { data, error } = await supabase
    .from("user_preferences")
    .select(
      "id, user_id, dashboard_layout, default_view, table_columns, table_sorting, table_filters, theme, compact_mode, sidebar_collapsed, desktop_notifications, sound_enabled, created_at, updated_at",
    )
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (!data) {
    // Preferences don't exist, create defaults
    const { data: newPrefs, error: createError } = await supabase
      .from("user_preferences")
      .insert({
        user_id: ctx.userId,
      })
      .select()
      .single()

    if (createError) {
      return { error: createError.message, data: null }
    }

    data = newPrefs
  } else if (error) {
    return { error: safeDbError(error), data: null }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
      .eq("user_id", ctx.userId)
      .select()
      .single()

    data = updated
    error = updateError
  } else {
    // Create new
    const { data: created, error: createError } = await supabase
      .from("user_preferences")
      .insert({
        user_id: ctx.userId,
        ...preferences,
      })
      .select()
      .single()

    data = created
    error = createError
  }

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  revalidatePath("/dashboard/settings")
  return { data, error: null }
}















