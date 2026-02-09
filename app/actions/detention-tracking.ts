"use server"

/**
 * Automated Detention Tracking
 * Monitors time drivers spend in zones and automatically adds detention fees
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface DetentionRecord {
  id: string
  geofence_id: string
  zone_visit_id: string
  load_id: string | null
  truck_id: string
  driver_id: string | null
  entry_timestamp: string
  exit_timestamp: string | null
  total_minutes: number
  detention_minutes: number
  detention_threshold_minutes: number
  hourly_rate: number
  total_fee: number
  status: 'active' | 'completed' | 'billed' | 'waived'
  invoice_id: string | null
  notes: string | null
  auto_generated: boolean
  geofence?: { name: string }
  truck?: { truck_number: string }
  driver?: { name: string }
  load?: { shipment_number: string }
}

/**
 * Get active detention records (drivers currently in zones beyond threshold)
 */
export async function getActiveDetentions() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { data: activeDetentions, error } = await supabase.rpc('calculate_active_detention')

    if (error) {
      return { error: error.message || "Failed to get active detentions", data: null }
    }

    // Get full details for each detention
    const detentionIds = activeDetentions?.map((d: any) => d.zone_visit_id) || []
    
    if (detentionIds.length === 0) {
      return { data: [], error: null }
    }

    const { data: detentions, error: detError } = await supabase
      .from("detention_tracking")
      .select(`
        *,
        geofences:geofence_id (id, name),
        trucks:truck_id (id, truck_number),
        drivers:driver_id (id, name),
        loads:load_id (id, shipment_number)
      `)
      .in('zone_visit_id', detentionIds)
      .eq('status', 'active')
      .eq('company_id', company_id)

    if (detError) {
      return { error: detError.message, data: null }
    }

    return { data: detentions || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get active detentions", data: null }
  }
}

/**
 * Get all detention records
 */
export async function getDetentionRecords(filters?: {
  geofence_id?: string
  load_id?: string
  truck_id?: string
  driver_id?: string
  status?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let query = supabase
      .from("detention_tracking")
      .select(`
        *,
        geofences:geofence_id (id, name),
        trucks:truck_id (id, truck_number),
        drivers:driver_id (id, name),
        loads:load_id (id, shipment_number),
        invoices:invoice_id (id, invoice_number)
      `, { count: "exact" })
      .eq("company_id", company_id)
      .order("entry_timestamp", { ascending: false })

    if (filters?.geofence_id) {
      query = query.eq("geofence_id", filters.geofence_id)
    }
    if (filters?.load_id) {
      query = query.eq("load_id", filters.load_id)
    }
    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }
    if (filters?.start_date) {
      query = query.gte("entry_timestamp", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("entry_timestamp", filters.end_date)
    }

    const limit = Math.min(filters?.limit || 50, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: detentions, error, count } = await query

    if (error) {
      return { error: error.message, data: null, count: 0 }
    }

    return { data: detentions || [], error: null, count: count || 0 }
  } catch (error: any) {
    return { error: error.message || "Failed to get detention records", data: null, count: 0 }
  }
}

/**
 * Check for new detentions and create records
 * This should be called periodically (e.g., every 15 minutes via cron)
 */
export async function checkAndCreateDetentions() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get active detentions
    const { data: activeDetentions, error: activeError } = await supabase.rpc('calculate_active_detention')

    if (activeError) {
      return { error: activeError.message, data: null }
    }

    const created: string[] = []
    const errors: Array<{ zone_visit_id: string; error: string }> = []

    // Create detention records for each active detention
    for (const detention of activeDetentions || []) {
      try {
        // Check if detention already exists
        const { data: existing } = await supabase
          .from("detention_tracking")
          .select("id")
          .eq("zone_visit_id", detention.zone_visit_id)
          .eq("status", "active")
          .single()

        if (existing) {
          // Update existing record
          const { data: updated } = await supabase.rpc('create_detention_record', {
            p_zone_visit_id: detention.zone_visit_id,
            p_load_id: null
          })
          if (updated) created.push(updated)
        } else {
          // Create new record
          const { data: newId } = await supabase.rpc('create_detention_record', {
            p_zone_visit_id: detention.zone_visit_id,
            p_load_id: null
          })
          if (newId) created.push(newId)
        }
      } catch (error: any) {
        errors.push({
          zone_visit_id: detention.zone_visit_id,
          error: error.message
        })
      }
    }

    return {
      data: {
        created: created.length,
        errors: errors.length,
        details: errors
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to check detentions", data: null }
  }
}

/**
 * Finalize detention when driver exits zone
 */
export async function finalizeDetention(zoneVisitId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: detentionId, error } = await supabase.rpc('finalize_detention_on_exit', {
      p_zone_visit_id: zoneVisitId
    })

    if (error) {
      return { error: error.message || "Failed to finalize detention", data: null }
    }

    return { data: { detention_id: detentionId }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to finalize detention", data: null }
  }
}

/**
 * Add detention fee to invoice
 */
export async function addDetentionToInvoice(detentionId: string, invoiceId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { data: success, error } = await supabase.rpc('add_detention_to_invoice', {
      p_detention_id: detentionId,
      p_invoice_id: invoiceId
    })

    if (error) {
      return { error: error.message || "Failed to add detention to invoice", data: null }
    }

    return { data: { success }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to add detention to invoice", data: null }
  }
}

/**
 * Auto-add detention fees to invoice when load is delivered
 */
export async function autoAddDetentionsToInvoice(loadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get invoice for this load
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("load_id", loadId)
      .eq("company_id", company_id)
      .single()

    if (!invoice) {
      return { error: "No invoice found for this load", data: null }
    }

    // Get completed detentions for this load that haven't been billed
    const { data: detentions } = await supabase
      .from("detention_tracking")
      .select("id")
      .eq("load_id", loadId)
      .eq("status", "completed")
      .is("invoice_id", null)

    if (!detentions || detentions.length === 0) {
      return { data: { added: 0 }, error: null }
    }

    let added = 0
    const errors: string[] = []

    // Add each detention to invoice
    for (const detention of detentions) {
      const result = await addDetentionToInvoice(detention.id, invoice.id)
      if (result.error) {
        errors.push(result.error)
      } else {
        added++
      }
    }

    return {
      data: {
        added,
        errors: errors.length > 0 ? errors : undefined
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to auto-add detentions", data: null }
  }
}

/**
 * Update geofence detention settings
 */
export async function updateGeofenceDetentionSettings(
  geofenceId: string,
  settings: {
    detention_enabled?: boolean
    detention_threshold_minutes?: number
    detention_hourly_rate?: number
    detention_auto_bill?: boolean
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

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const updateData: any = {}
    
    if (settings.detention_enabled !== undefined) {
      updateData.detention_enabled = settings.detention_enabled
    }
    if (settings.detention_threshold_minutes !== undefined) {
      updateData.detention_threshold_minutes = settings.detention_threshold_minutes
    }
    if (settings.detention_hourly_rate !== undefined) {
      updateData.detention_hourly_rate = settings.detention_hourly_rate
    }
    if (settings.detention_auto_bill !== undefined) {
      updateData.detention_auto_bill = settings.detention_auto_bill
    }

    const { data, error } = await supabase
      .from("geofences")
      .update(updateData)
      .eq("id", geofenceId)
      .eq("company_id", company_id)
      .select()
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update detention settings", data: null }
  }
}



