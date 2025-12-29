"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"

export async function getDashboardStats() {
  try {
    const supabase = await createClient()

    // Get authenticated user and company_id
    const { companyId, error: authError } = await getAuthContext()

    if (authError || !companyId) {
      return { error: authError || "Not authenticated", data: null }
    }

    // Get counts for all entities - optimized to use count queries instead of fetching data
    const [
      totalDriversResult,
      activeDriversResult,
      totalTrucksResult,
      activeTrucksResult,
      totalRoutesResult,
      activeRoutesResult,
      totalLoadsResult,
      inTransitLoadsResult,
      totalMaintenanceResult,
      scheduledMaintenanceResult,
    ] = await Promise.all([
      // Total counts
      supabase.from("drivers").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("drivers").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["active", "on_route"]),
      supabase.from("trucks").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("trucks").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["available", "in_use"]),
      supabase.from("routes").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("routes").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["in_progress", "scheduled"]),
      supabase.from("loads").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("loads").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "in_transit"),
      supabase.from("maintenance").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("maintenance").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["scheduled", "overdue"]),
    ])

    const totalDrivers = totalDriversResult.count || 0
    const activeDrivers = activeDriversResult.count || 0
    const totalTrucks = totalTrucksResult.count || 0
    const activeTrucks = activeTrucksResult.count || 0
    const totalRoutes = totalRoutesResult.count || 0
    const activeRoutes = activeRoutesResult.count || 0
    const totalLoads = totalLoadsResult.count || 0
    const inTransitLoads = inTransitLoadsResult.count || 0
    const totalMaintenance = totalMaintenanceResult.count || 0
    const scheduledMaintenance = scheduledMaintenanceResult.count || 0

    // Calculate fleet utilization
    const fleetUtilization = totalTrucks > 0 ? Math.round((activeTrucks / totalTrucks) * 100) : 0

    // Get recent activity - last 5 items from various tables
    const recentActivity: Array<{ action: string; time: string; type: string }> = []

    // Get recent loads
    const { data: recentLoads } = await supabase
      .from("loads")
      .select("shipment_number, created_at, status")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(3)

    if (recentLoads) {
      recentLoads.forEach((load) => {
        recentActivity.push({
          action: `Load ${load.shipment_number} ${load.status === "in_transit" ? "is in transit" : load.status === "delivered" ? "was delivered" : "was created"}`,
          time: load.created_at,
          type: load.status === "delivered" ? "success" : load.status === "in_transit" ? "info" : "default",
        })
      })
    }

    // Get recent drivers
    const { data: recentDrivers } = await supabase
      .from("drivers")
      .select("name, created_at, status")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(2)

    if (recentDrivers) {
      recentDrivers.forEach((driver) => {
        recentActivity.push({
          action: `Driver ${driver.name} was ${driver.status === "active" ? "added" : "updated"}`,
          time: driver.created_at,
          type: "success",
        })
      })
    }

    // Get recent maintenance
    const { data: recentMaintenance } = await supabase
      .from("maintenance")
      .select("service_type, scheduled_date, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(2)

    if (recentMaintenance) {
      recentMaintenance.forEach((maint) => {
        const date = maint.scheduled_date ? new Date(maint.scheduled_date).toLocaleDateString() : "TBD"
        recentActivity.push({
          action: `Maintenance for ${maint.service_type} scheduled for ${date}`,
          time: maint.created_at,
          type: maint.status === "overdue" ? "error" : maint.status === "completed" ? "success" : "warning",
        })
      })
    }

    // Get recent routes
    const { data: recentRoutes } = await supabase
      .from("routes")
      .select("name, created_at, status, updated_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(2)

    if (recentRoutes) {
      recentRoutes.forEach((route) => {
        recentActivity.push({
          action: `Route ${route.name} was ${route.status === "completed" ? "completed" : route.status === "in_progress" ? "started" : "created"}`,
          time: route.updated_at || route.created_at,
          type: route.status === "completed" ? "success" : route.status === "in_progress" ? "info" : "default",
        })
      })
    }

    // Get recent invoices
    const { data: recentInvoices } = await supabase
      .from("invoices")
      .select("invoice_number, created_at, status, amount")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(2)

    if (recentInvoices) {
      recentInvoices.forEach((invoice) => {
        recentActivity.push({
          action: `Invoice ${invoice.invoice_number} for $${Number(invoice.amount).toFixed(2)} was ${invoice.status === "paid" ? "paid" : invoice.status === "sent" ? "sent" : "created"}`,
          time: invoice.created_at,
          type: invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "error" : "info",
        })
      })
    }

    // Get recent settlements
    const { data: recentSettlements } = await supabase
      .from("settlements")
      .select("created_at, status, net_pay, drivers(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(2)

    if (recentSettlements) {
      recentSettlements.forEach((settlement: any) => {
        const driverName = settlement.drivers?.name || "Driver"
        recentActivity.push({
          action: `Settlement for ${driverName} ($${Number(settlement.net_pay).toFixed(2)}) was ${settlement.status === "paid" ? "paid" : "created"}`,
          time: settlement.created_at,
          type: settlement.status === "paid" ? "success" : "info",
        })
      })
    }

    // Sort by time (most recent first) and limit to 5
    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    const sortedRecentActivity = recentActivity.slice(0, 5)

    // Get sample data for dashboard cards
    const { data: recentDriversData } = await supabase
      .from("drivers")
      .select("id, name, status, phone")
      .eq("company_id", companyId)
      .in("status", ["active", "on_route"])
      .order("created_at", { ascending: false })
      .limit(3)

    const { data: recentTrucksData } = await supabase
      .from("trucks")
      .select("id, truck_number, make, model, status")
      .eq("company_id", companyId)
      .in("status", ["available", "in_use"])
      .order("created_at", { ascending: false })
      .limit(3)

    const { data: recentRoutesData } = await supabase
      .from("routes")
      .select("id, name, origin, destination, status")
      .eq("company_id", companyId)
      .in("status", ["in_progress", "scheduled"])
      .order("updated_at", { ascending: false })
      .limit(3)

    const { data: recentLoadsData } = await supabase
      .from("loads")
      .select("id, shipment_number, origin, destination, status")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(3)

    return {
      data: {
        totalDrivers,
        activeDrivers,
        totalTrucks,
        activeTrucks,
        totalRoutes,
        activeRoutes,
        totalLoads,
        inTransitLoads,
        totalMaintenance,
        scheduledMaintenance,
        fleetUtilization,
        recentActivity: sortedRecentActivity,
        recentDrivers: recentDriversData || [],
        recentTrucks: recentTrucksData || [],
        recentRoutes: recentRoutesData || [],
        recentLoads: recentLoadsData || [],
      },
      error: null,
    }
  } catch (error: any) {
    console.error("Error in getDashboardStats:", error)
    return {
      error: error?.message || "An unexpected error occurred while loading dashboard stats",
      data: null,
    }
  }
}

