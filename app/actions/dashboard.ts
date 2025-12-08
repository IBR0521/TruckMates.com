"use server"

import { createClient } from "@/lib/supabase/server"

export async function getDashboardStats() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  // Get user's company_id
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const companyId = userData.company_id

  // Get counts for all entities
  const [driversResult, trucksResult, routesResult, loadsResult, maintenanceResult] = await Promise.all([
    supabase.from("drivers").select("id, status", { count: "exact" }).eq("company_id", companyId),
    supabase.from("trucks").select("id, status", { count: "exact" }).eq("company_id", companyId),
    supabase.from("routes").select("id, status", { count: "exact" }).eq("company_id", companyId),
    supabase.from("loads").select("id, status", { count: "exact" }).eq("company_id", companyId),
    supabase.from("maintenance").select("id, status", { count: "exact" }).eq("company_id", companyId),
  ])

  const totalDrivers = driversResult.count || 0
  const activeDrivers = driversResult.data?.filter((d) => d.status === "active" || d.status === "on_route").length || 0
  const totalTrucks = trucksResult.count || 0
  const activeTrucks = trucksResult.data?.filter((t) => t.status === "available" || t.status === "in_use").length || 0
  const totalRoutes = routesResult.count || 0
  const activeRoutes = routesResult.data?.filter((r) => r.status === "in_progress" || r.status === "scheduled").length || 0
  const totalLoads = loadsResult.count || 0
  const inTransitLoads = loadsResult.data?.filter((l) => l.status === "in_transit").length || 0
  const totalMaintenance = maintenanceResult.count || 0
  const scheduledMaintenance = maintenanceResult.data?.filter((m) => m.status === "scheduled" || m.status === "overdue").length || 0

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
    .select("name, created_at, status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(2)

  if (recentRoutes) {
    recentRoutes.forEach((route) => {
      recentActivity.push({
        action: `Route ${route.name} was ${route.status === "completed" ? "completed" : route.status === "in_progress" ? "started" : "created"}`,
        time: route.created_at,
        type: route.status === "completed" ? "success" : route.status === "in_progress" ? "info" : "default",
      })
    })
  }

  // Sort by time (most recent first) and limit to 5
  recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  const sortedRecentActivity = recentActivity.slice(0, 5)

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
    },
    error: null,
  }
}

