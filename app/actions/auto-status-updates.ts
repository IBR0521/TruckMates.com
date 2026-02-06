"use server"

/**
 * Automated Load Status Updates
 * Auto-update load status when driver enters/exits geofences
 */

import { createClient } from "@/lib/supabase/server"

/**
 * Auto-update load status from geofence entry/exit
 * This is called by the geofence trigger, but can also be called manually
 */
export async function autoUpdateLoadStatusFromGeofence(
  zoneVisitId: string,
  eventType: 'entry' | 'exit'
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
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
      return { error: error.message || "Failed to update load status", data: null }
    }

    return { data: { history_id: historyId, updated: historyId !== null }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update load status", data: null }
  }
}

/**
 * Get load status history
 */
export async function getLoadStatusHistory(loadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: history || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get status history", data: null }
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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
      .eq("company_id", userData.company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update geofence status mapping", data: null }
  }
}


