"use server"

/**
 * Automated Load Status Updates
 * Auto-update load status when driver enters/exits geofences
 */

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Auto-update load status from geofence entry/exit
 * This is called by the geofence trigger, but can also be called manually
 */
export async function autoUpdateLoadStatusFromGeofence(
  zoneVisitId: string,
  eventType: 'entry' | 'exit'
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: historyId, error } = await supabase.rpc('auto_update_load_status_from_geofence', {
      p_zone_visit_id: zoneVisitId,
      p_event_type: eventType
    })

    if (error) {
      // Don't fail if no load found - that's expected sometimes
      if (error.message.includes('No active load found') || error.message.includes('not found')) {
        return { data: { updated: false, reason: 'no_active_load' }, error: null }
      }
      return { error: safeDbError(error) || "Failed to update load status", data: null }
    }

    return { data: { history_id: historyId, updated: historyId !== null }, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update load status"), data: null }
  }
}

/**
 * Get load status history
 */
export async function getLoadStatusHistory(loadId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: history, error } = await supabase
      .from("load_status_history")
      .select(`
        *,
        geofences:geofence_id (id, name),
        users:changed_by (id, name)
      `)
      .eq("load_id", loadId)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: history || [], error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get status history"), data: null }
  }
}

/**
 * Update geofence status mapping settings
 */
export async function updateGeofenceStatusMapping(
  geofenceId: string,
  settings: {
    auto_update_load_status?: boolean
    entry_load_status?: string | null
    exit_load_status?: string | null
  }
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const updateData: any = {}
    
    if (settings.auto_update_load_status !== undefined) {
      updateData.auto_update_load_status = settings.auto_update_load_status
    }
    if (settings.entry_load_status !== undefined) {
      updateData.entry_load_status = settings.entry_load_status || null
    }
    if (settings.exit_load_status !== undefined) {
      updateData.exit_load_status = settings.exit_load_status || null
    }

    const { data, error } = await supabase
      .from("geofences")
      .update(updateData)
      .eq("id", geofenceId)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update geofence status mapping"), data: null }
  }
}



