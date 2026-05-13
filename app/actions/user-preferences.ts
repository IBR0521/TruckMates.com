"use server"

import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
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
  dashboard_layout?: unknown
  default_view?: string
  table_columns?: unknown
  table_sorting?: unknown
  table_filters?: unknown
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

/**
 * In-app notification smart UI (Pro+ plan + per-user toggle on `users.notification_smart_mode`).
 */
export async function updateNotificationSmartMode(enabled: boolean): Promise<{
  data: { enabled: boolean } | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { error } = await supabase
    .from("users")
    .update({ notification_smart_mode: enabled })
    .eq("id", ctx.userId)

  if (error) {
    return { data: null, error: safeDbError(error) }
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/notifications")
  return { data: { enabled }, error: null }
}

export async function getNotificationSmartDisplayState(): Promise<{
  data: { smartUi: boolean; planAllowsSmart: boolean; userSmart: boolean } | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const [{ data: companyRow }, { data: userRow }] = await Promise.all([
    supabase.from("companies").select("subscription_tier").eq("id", ctx.companyId).maybeSingle(),
    supabase.from("users").select("notification_smart_mode").eq("id", ctx.userId).maybeSingle(),
  ])

  const tier: PlanTier = normalizePlanTier(
    (companyRow as { subscription_tier?: string | null } | null)?.subscription_tier ?? undefined,
  )
  const planAllowsSmart = hasFeatureAccess(tier, "ai_smart_notifications")
  const userSmart = Boolean((userRow as { notification_smart_mode?: boolean } | null)?.notification_smart_mode)

  return {
    data: {
      smartUi: planAllowsSmart && userSmart,
      planAllowsSmart,
      userSmart,
    },
    error: null,
  }
}
