"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/server-helpers"
import { cache, cacheKeys } from "@/lib/cache"

/**
 * FAST dashboard stats - optimized for speed with aggressive timeouts
 */
export async function getDashboardStats() {
  try {
    // Try to create Supabase client with error handling
    let supabase
    try {
      supabase = await createClient()
    } catch (clientError: any) {
      console.error("Failed to create Supabase client:", clientError)
      const errorMessage = clientError?.message || "Failed to connect to database"
      
      // Return minimal data with connection error info
      return {
        data: {
          totalDrivers: 0,
          activeDrivers: 0,
          totalTrucks: 0,
          activeTrucks: 0,
          totalRoutes: 0,
          activeRoutes: 0,
          totalLoads: 0,
          inTransitLoads: 0,
          totalMaintenance: 0,
          scheduledMaintenance: 0,
          fleetUtilization: 0,
          recentActivity: [],
          recentDrivers: [],
          recentTrucks: [],
          recentRoutes: [],
          recentLoads: [],
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          profitMargin: 0,
          outstandingInvoices: 0,
          revenueTrend: [],
          loadStatusDistribution: [],
          upcomingMaintenance: [],
          overdueInvoices: [],
          upcomingDeliveries: [],
        },
        error: errorMessage.includes('Missing Supabase') 
          ? "Database configuration error. Please check your Supabase settings."
          : errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')
          ? "Connection failed. Please check your internet connection."
          : "Database connection error. Please try again.",
      }
    }

    // Get authenticated user and company_id with reasonable timeout (3 seconds)
    const authPromise = getAuthContext()
    const authTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve({ companyId: null, error: "Auth timeout" })
      }, 5000) // Increased to 5 seconds - more reasonable
    })

    const { companyId, error: authError } = await Promise.race([
      authPromise,
      authTimeout
    ]) as any

    if (authError || !companyId) {
      // Check if it's a connection error
      const isConnectionError = authError?.includes('timeout') || 
                                 authError?.includes('ECONNREFUSED') || 
                                 authError?.includes('Connection failed') ||
                                 authError?.includes('Database configuration')
      
      // Return minimal data instead of error to prevent UI blocking
      return {
        data: {
          totalDrivers: 0,
          activeDrivers: 0,
          totalTrucks: 0,
          activeTrucks: 0,
          totalRoutes: 0,
          activeRoutes: 0,
          totalLoads: 0,
          inTransitLoads: 0,
          totalMaintenance: 0,
          scheduledMaintenance: 0,
          fleetUtilization: 0,
          recentActivity: [],
          recentDrivers: [],
          recentTrucks: [],
          recentRoutes: [],
          recentLoads: [],
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          profitMargin: 0,
          outstandingInvoices: 0,
          revenueTrend: [],
          loadStatusDistribution: [],
          upcomingMaintenance: [],
          overdueInvoices: [],
          upcomingDeliveries: [],
        },
        error: isConnectionError ? authError : null, // Only show connection errors
      }
    }

    // Check cache first (30 second TTL for dashboard stats)
    const cacheKey = cacheKeys.dashboardStats(companyId)
    const cached = cache.get<any>(cacheKey)
    if (cached) {
      return { data: cached, error: null }
    }

    // Get counts for all entities - optimized to use count queries instead of fetching data
    let countResults: any[] = []
    try {
      countResults = await Promise.all([
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
    } catch (countError) {
      console.error("Error fetching counts:", countError)
      // If counts fail, use zeros
      countResults = Array(10).fill({ count: 0 })
    }

    const totalDrivers = countResults[0]?.count || 0
    const activeDrivers = countResults[1]?.count || 0
    const totalTrucks = countResults[2]?.count || 0
    const activeTrucks = countResults[3]?.count || 0
    const totalRoutes = countResults[4]?.count || 0
    const activeRoutes = countResults[5]?.count || 0
    const totalLoads = countResults[6]?.count || 0
    const inTransitLoads = countResults[7]?.count || 0
    const totalMaintenance = countResults[8]?.count || 0
    const scheduledMaintenance = countResults[9]?.count || 0

    // Calculate fleet utilization
    const fleetUtilization = totalTrucks > 0 ? Math.round((activeTrucks / totalTrucks) * 100) : 0

    // Get recent activity - fetch all in parallel with timeout protection
    const activityPromise = Promise.all([
      supabase.from("loads").select("shipment_number, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(3),
      supabase.from("drivers").select("name, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("maintenance").select("service_type, scheduled_date, status, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("routes").select("name, created_at, status, updated_at").eq("company_id", companyId).order("updated_at", { ascending: false }).limit(2),
      supabase.from("invoices").select("invoice_number, created_at, status, amount").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("settlements").select("created_at, status, net_pay, drivers(name)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
    ]).catch(() => {
      // Return empty arrays if query fails
      return [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ]
    })

    const activityTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ])
      }, 5000) // Increased to 5 seconds
    })

    const [
      { data: recentLoads },
      { data: recentDrivers },
      { data: recentMaintenance },
      { data: recentRoutes },
      { data: recentInvoices },
      { data: recentSettlements },
    ] = await Promise.race([activityPromise, activityTimeout]) as any

    // Build recent activity array
    const recentActivity: Array<{ action: string; time: string; type: string }> = []

    if (recentLoads) {
      recentLoads.forEach((load) => {
        recentActivity.push({
          action: `Load ${load.shipment_number} ${load.status === "in_transit" ? "is in transit" : load.status === "delivered" ? "was delivered" : "was created"}`,
          time: load.created_at,
          type: load.status === "delivered" ? "success" : load.status === "in_transit" ? "info" : "default",
        })
      })
    }

    if (recentDrivers) {
      recentDrivers.forEach((driver) => {
        recentActivity.push({
          action: `Driver ${driver.name} was ${driver.status === "active" ? "added" : "updated"}`,
          time: driver.created_at,
          type: "success",
        })
      })
    }

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

    if (recentRoutes) {
      recentRoutes.forEach((route) => {
        recentActivity.push({
          action: `Route ${route.name} was ${route.status === "completed" ? "completed" : route.status === "in_progress" ? "started" : "created"}`,
          time: route.updated_at || route.created_at,
          type: route.status === "completed" ? "success" : route.status === "in_progress" ? "info" : "default",
        })
      })
    }

    if (recentInvoices) {
      recentInvoices.forEach((invoice) => {
        recentActivity.push({
          action: `Invoice ${invoice.invoice_number} for $${Number(invoice.amount).toFixed(2)} was ${invoice.status === "paid" ? "paid" : invoice.status === "sent" ? "sent" : "created"}`,
          time: invoice.created_at,
          type: invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "error" : "info",
        })
      })
    }

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

    // Get sample data for dashboard cards - fetch in parallel for speed (with timeout)
    const cardQueries = Promise.all([
      supabase.from("drivers").select("id, name, status, phone").eq("company_id", companyId).in("status", ["active", "on_route"]).order("created_at", { ascending: false }).limit(3),
      supabase.from("trucks").select("id, truck_number, make, model, status").eq("company_id", companyId).in("status", ["available", "in_use"]).order("created_at", { ascending: false }).limit(3),
      supabase.from("routes").select("id, name, origin, destination, status").eq("company_id", companyId).in("status", ["in_progress", "scheduled"]).order("updated_at", { ascending: false }).limit(3),
      supabase.from("loads").select("id, shipment_number, origin, destination, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(3),
    ])
    
    const cardTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Card data timeout")), 8000) // Increased to 8 seconds
    })
    
    let recentDriversData: any = null
    let recentTrucksData: any = null
    let recentRoutesData: any = null
    let recentLoadsData: any = null
    
    try {
      const results = await Promise.race([cardQueries, cardTimeout]) as any[]
      recentDriversData = results[0]?.data
      recentTrucksData = results[1]?.data
      recentRoutesData = results[2]?.data
      recentLoadsData = results[3]?.data
    } catch (error) {
      // If timeout, continue with empty arrays
      console.warn("Card data queries timed out, using empty data")
    }

    // Get financial metrics (with timeout protection)
    const financialPromise = Promise.all([
      supabase.from("invoices").select("amount, status, issue_date").eq("company_id", companyId).eq("status", "paid"),
      supabase.from("expenses").select("amount, date").eq("company_id", companyId),
      supabase.from("invoices").select("amount, status, due_date").eq("company_id", companyId).in("status", ["sent", "overdue"]),
    ]).catch(() => {
      return [
        { data: [] },
        { data: [] },
        { data: [] },
      ]
    })

    const financialTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { data: [] },
          { data: [] },
          { data: [] },
        ])
      }, 3000)
    })

    const [
      { data: paidInvoices },
      { data: expenses },
      { data: pendingInvoices },
    ] = await Promise.race([financialPromise, financialTimeout]) as any

    // Calculate financial metrics
    const totalRevenue = paidInvoices?.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0) || 0
    const totalExpenses = expenses?.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0) || 0
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0
    const outstandingInvoices = pendingInvoices?.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0) || 0

    // Get revenue trend data (last 30 days)
    let revenueTrendData: any[] = []
    try {
      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const revenueTrendResult = await supabase
        .from("invoices")
        .select("amount, issue_date")
        .eq("company_id", companyId)
        .eq("status", "paid")
        .gte("issue_date", thirtyDaysAgo.toISOString().split('T')[0])
        .order("issue_date", { ascending: true })
      
      revenueTrendData = revenueTrendResult.data || []
    } catch (error) {
      console.error("Error fetching revenue trend:", error)
      revenueTrendData = []
    }

    // Group revenue by date
    const revenueByDate: Record<string, number> = {}
    revenueTrendData?.forEach((inv: any) => {
      const date = inv.issue_date?.split('T')[0] || ''
      revenueByDate[date] = (revenueByDate[date] || 0) + (Number(inv.amount) || 0)
    })

    // Get load status distribution
    let allLoads: any[] = []
    try {
      const loadStatusResult = await supabase
        .from("loads")
        .select("status")
        .eq("company_id", companyId)
      
      allLoads = loadStatusResult.data || []
    } catch (error) {
      console.error("Error fetching load status:", error)
      allLoads = []
    }

    // Count loads by status
    const loadStatusCounts: Record<string, number> = {}
    allLoads?.forEach((load: any) => {
      const status = load.status || 'unknown'
      loadStatusCounts[status] = (loadStatusCounts[status] || 0) + 1
    })

    // Get critical alerts
    let upcomingMaintenance: any[] = []
    let overdueInvoices: any[] = []
    let upcomingDeliveries: any[] = []
    
    try {
      const alertsResults = await Promise.all([
        supabase.from("maintenance")
          .select("id, service_type, scheduled_date, status")
          .eq("company_id", companyId)
          .in("status", ["overdue", "scheduled"])
          .lte("scheduled_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(5)
          .catch(() => ({ data: [] })),
        supabase.from("invoices")
          .select("id, invoice_number, due_date, amount, status")
          .eq("company_id", companyId)
          .eq("status", "overdue")
          .limit(5)
          .catch(() => ({ data: [] })),
        supabase.from("loads")
          .select("id, shipment_number, estimated_delivery, status")
          .eq("company_id", companyId)
          .eq("status", "in_transit")
          .lte("estimated_delivery", new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())
          .limit(5)
          .catch(() => ({ data: [] })),
      ])
      
      upcomingMaintenance = alertsResults[0]?.data || []
      overdueInvoices = alertsResults[1]?.data || []
      upcomingDeliveries = alertsResults[2]?.data || []
    } catch (error) {
      console.error("Error fetching alerts:", error)
      // Use empty arrays if alerts fail
    }


    const dashboardData = {
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
      // Financial metrics
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      outstandingInvoices,
      revenueTrend: Object.entries(revenueByDate).map(([date, amount]) => ({ date, amount })),
      loadStatusDistribution: Object.entries(loadStatusCounts).map(([status, count]) => ({ status, count })),
      // Alerts
      upcomingMaintenance: upcomingMaintenance || [],
      overdueInvoices: overdueInvoices || [],
      upcomingDeliveries: upcomingDeliveries || [],
    }

    // Cache for 60 seconds (longer cache for better performance)
    cache.set(cacheKey, dashboardData, 60000)

    return {
      data: dashboardData,
      error: null,
    }
  } catch (error: any) {
    console.error("Error in getDashboardStats:", error)
    // Return minimal data instead of error to prevent UI blocking
    return {
        data: {
          totalDrivers: 0,
          activeDrivers: 0,
          totalTrucks: 0,
          activeTrucks: 0,
          totalRoutes: 0,
          activeRoutes: 0,
          totalLoads: 0,
          inTransitLoads: 0,
          totalMaintenance: 0,
          scheduledMaintenance: 0,
          fleetUtilization: 0,
          recentActivity: [],
          recentDrivers: [],
          recentTrucks: [],
          recentRoutes: [],
          recentLoads: [],
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          profitMargin: 0,
          outstandingInvoices: 0,
          revenueTrend: [],
          loadStatusDistribution: [],
          upcomingMaintenance: [],
          overdueInvoices: [],
          upcomingDeliveries: [],
        },
        error: null, // Don't return error to prevent UI blocking
    }
  }
}

