"use server"

/**
 * Automated Detention Tracking
 * Monitors time drivers spend in zones and automatically adds detention fees
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission, checkCreatePermission } from "@/lib/server-permissions"

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
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // UPDATED: RPC now accepts p_company_id to enforce company isolation
    const { data: activeDetentions, error } = await supabase.rpc('calculate_active_detention', {
      p_company_id: ctx.companyId,
    })

    if (error) {
      return { error: error.message || "Failed to get active detentions", data: null }
    }

    if (!activeDetentions || activeDetentions.length === 0) {
      return { data: [], error: null }
    }

    // FIXED: Filter zone_visit_ids by company_id to prevent cross-company data leak
    const zoneVisitIds = activeDetentions.map((d: any) => d.zone_visit_id)
    const { data: zoneVisits } = await supabase
      .from("zone_visits")
      .select("id, geofence_id")
      .in("id", zoneVisitIds)
    
    const { data: geofences } = await supabase
      .from("geofences")
      .select("id, company_id")
      .eq("company_id", ctx.companyId)
      .in("id", zoneVisits?.map((zv: any) => zv.geofence_id) || [])
    
    const validGeofenceIds = new Set(geofences?.map((g: any) => g.id) || [])
    const validZoneVisitIds = zoneVisits
      ?.filter((zv: any) => validGeofenceIds.has(zv.geofence_id))
      .map((zv: any) => zv.id) || []
    
    if (validZoneVisitIds.length === 0) {
      return { data: [], error: null }
    }

    // Get full details for each detention
    const { data: detentions, error: detError } = await supabase
      .from("detention_tracking")
      .select(`
        *,
        geofences:geofence_id (id, name),
        trucks:truck_id (id, truck_number),
        drivers:driver_id (id, name),
        loads:load_id (id, shipment_number)
      `)
      .in('zone_visit_id', validZoneVisitIds)
      .eq('status', 'active')
      .eq('company_id', ctx.companyId)

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
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
      .eq("company_id", ctx.companyId)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // UPDATED: RPC now accepts p_company_id to enforce company isolation
    const { data: activeDetentions, error: activeError } = await supabase.rpc('calculate_active_detention', {
      p_company_id: ctx.companyId,
    })

    if (activeError) {
      return { error: activeError.message, data: null }
    }

    if (!activeDetentions || activeDetentions.length === 0) {
      return {
        data: {
          created: 0,
          errors: 0,
          details: []
        },
        error: null
      }
    }

    // FIXED: Filter zone_visit_ids by company_id to prevent cross-company data leak
    const zoneVisitIds = activeDetentions.map((d: any) => d.zone_visit_id)
    const { data: zoneVisits } = await supabase
      .from("zone_visits")
      .select("id, geofence_id")
      .in("id", zoneVisitIds)
    
    const { data: geofences } = await supabase
      .from("geofences")
      .select("id, company_id")
      .eq("company_id", ctx.companyId)
      .in("id", zoneVisits?.map((zv: any) => zv.geofence_id) || [])
    
    const validGeofenceIds = new Set(geofences?.map((g: any) => g.id) || [])
    const validDetentions = activeDetentions.filter((d: any) => {
      const zv = zoneVisits?.find((zv: any) => zv.id === d.zone_visit_id)
      return zv && validGeofenceIds.has(zv.geofence_id)
    })

    const created: string[] = []
    const errors: Array<{ zone_visit_id: string; error: string }> = []

    // Create detention records for each active detention (filtered by company)
    for (const detention of validDetentions) {
      try {
        // Check if detention already exists
        const { data: existing } = await supabase
          .from("detention_tracking")
          .select("id")
          .eq("zone_visit_id", detention.zone_visit_id)
          .eq("status", "active")
          .single()

        if (existing) {
          // FIXED: Update existing record using UPDATE, not create_detention_record
          const { error: updateError } = await supabase
            .from("detention_tracking")
            .update({
              detention_minutes: detention.detention_minutes || 0,
              total_fee: detention.total_fee || 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("company_id", ctx.companyId)
          
          if (!updateError) {
            created.push(existing.id)
          }
        } else {
          // Create new record
          // FIXED: Verify company_id before creating record
          const { data: zoneVisit } = await supabase
            .from("zone_visits")
            .select("geofence_id, geofences:geofence_id(company_id)")
            .eq("id", detention.zone_visit_id)
            .single()
          
          if (!zoneVisit || (zoneVisit.geofences as any)?.company_id !== ctx.companyId) {
            errors.push({
              zone_visit_id: detention.zone_visit_id,
              error: "Zone visit does not belong to your company"
            })
            continue
          }
          
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
  // FIXED: Add RBAC check
  const permissionCheck = await checkCreatePermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to manage detentions", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // FIXED: Verify ownership before calling RPC
    const { data: zoneVisit } = await supabase
      .from("zone_visits")
      .select("company_id")
      .eq("id", zoneVisitId)
      .single()
    
    if (!zoneVisit || zoneVisit.company_id !== ctx.companyId) {
      return { error: "Unauthorized: Zone visit does not belong to your company", data: null }
    }
    
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
  // FIXED: Add RBAC check
  const permissionCheck = await checkCreatePermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to manage detentions", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // FIXED: Verify ownership of both detention and invoice before calling RPC
    const { data: detention } = await supabase
      .from("detention_tracking")
      .select("company_id")
      .eq("id", detentionId)
      .single()
    
    if (!detention || detention.company_id !== ctx.companyId) {
      return { error: "Unauthorized: Detention does not belong to your company", data: null }
    }
    
    const { data: invoice } = await supabase
      .from("invoices")
      .select("company_id")
      .eq("id", invoiceId)
      .single()
    
    if (!invoice || invoice.company_id !== ctx.companyId) {
      return { error: "Unauthorized: Invoice does not belong to your company", data: null }
    }
    
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get invoice for this load
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("load_id", loadId)
      .eq("company_id", ctx.companyId)
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
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
      .eq("company_id", ctx.companyId)
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

/**
 * Get detention analytics - Top customers by detention cost
 */
export async function getDetentionAnalytics(filters?: {
  start_date?: string
  end_date?: string
  limit?: number
}) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Build query to get detention records with customer info
    let query = supabase
      .from("detention_tracking")
      .select(`
        id,
        total_fee,
        detention_minutes,
        entry_timestamp,
        loads!inner(
          id,
          customer_id,
          customers:customer_id(
            id,
            name,
            company_name
          )
        )
      `)
      .eq("company_id", ctx.companyId)
      .eq("status", "completed")
      .not("total_fee", "is", null)
      .gt("total_fee", 0)

    if (filters?.start_date) {
      query = query.gte("entry_timestamp", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("entry_timestamp", filters.end_date)
    }

    const { data: detentions, error } = await query

    if (error) {
      return { error: error.message || "Failed to get detention analytics", data: null }
    }

    // Aggregate by customer
    const customerMap = new Map<string, {
      customer_id: string
      customer_name: string
      total_fee: number
      total_minutes: number
      detention_count: number
      average_fee: number
    }>()

    detentions?.forEach((detention: any) => {
      const customer = detention.loads?.customers
      if (!customer || !customer.id) return

      const customerId = customer.id
      const customerName = customer.name || customer.company_name || "Unknown Customer"
      const fee = parseFloat(detention.total_fee) || 0
      const minutes = parseInt(detention.detention_minutes) || 0

      if (customerMap.has(customerId)) {
        const existing = customerMap.get(customerId)!
        existing.total_fee += fee
        existing.total_minutes += minutes
        existing.detention_count += 1
        existing.average_fee = existing.total_fee / existing.detention_count
      } else {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: customerName,
          total_fee: fee,
          total_minutes: minutes,
          detention_count: 1,
          average_fee: fee,
        })
      }
    })

    // FIXED: Calculate totals BEFORE slicing (from full dataset, not just top-N)
    const allCustomers = Array.from(customerMap.values())
    const totalDetentionFee = allCustomers.reduce((sum, c) => sum + c.total_fee, 0)
    const totalDetentionMinutes = allCustomers.reduce((sum, c) => sum + c.total_minutes, 0)
    const totalDetentionCount = allCustomers.reduce((sum, c) => sum + c.detention_count, 0)
    
    // Then slice for top customers display
    const topCustomers = allCustomers
      .sort((a, b) => b.total_fee - a.total_fee)
      .slice(0, filters?.limit || 10)

    return {
      data: {
        top_customers: topCustomers,
        summary: {
          total_fee: totalDetentionFee,
          total_minutes: totalDetentionMinutes,
          total_count: totalDetentionCount,
          average_fee_per_customer: topCustomers.length > 0 ? totalDetentionFee / topCustomers.length : 0,
        },
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get detention analytics", data: null }
  }
}



