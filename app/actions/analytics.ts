"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { checkViewPermission } from "@/lib/server-permissions"

/**
 * Get analytics dashboard data
 * FIXED: Server-side aggregation with limited column selection to prevent PII exposure
 */
export async function getAnalyticsData(dateRange: number = 30) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("reports")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
  }

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
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRange)

    // FIXED: Select only necessary columns, not all columns (prevents PII exposure)
    // Get loads statistics - only count and status fields
    const { data: loadsData, error: loadsError } = await supabase
      .from("loads")
      .select("id, status, estimated_delivery, actual_delivery, created_at")
      .eq("company_id", company_id)
      .gte("created_at", startDate.toISOString())

    if (loadsError) {
      return { error: loadsError.message, data: null }
    }

    // FIXED: Get trucks statistics - only count and status fields
    const { data: trucksData, error: trucksError } = await supabase
      .from("trucks")
      .select("id, status")
      .eq("company_id", company_id)

    if (trucksError) {
      return { error: trucksError.message, data: null }
    }

    // FIXED: Get drivers statistics - only count and status fields (no PII like SSN, DOB, address)
    const { data: driversData, error: driversError } = await supabase
      .from("drivers")
      .select("id, status")
      .eq("company_id", company_id)

    if (driversError) {
      return { error: driversError.message, data: null }
    }

    // Get invoices for revenue
    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoices")
      .select("amount, status, created_at")
      .eq("company_id", company_id)
      .gte("created_at", startDate.toISOString())

    if (invoicesError) {
      return { error: invoicesError.message, data: null }
    }

    // MEDIUM FIX: Add limit to prevent unbounded queries
    // Get revenue from loads as fallback
    const { data: loadsWithRevenue, error: loadsRevenueError } = await supabase
      .from("loads")
      .select("total_rate, value, created_at")
      .eq("company_id", company_id)
      .gte("created_at", startDate.toISOString())
      .limit(10000) // Reasonable limit for analytics

    if (loadsRevenueError) {
      return { error: loadsRevenueError.message, data: null }
    }

    // Calculate statistics
    const totalLoads = loadsData?.length || 0
    const activeLoads = loadsData?.filter((l) => l.status === "in_transit" || l.status === "scheduled").length || 0
    const completedLoads = loadsData?.filter((l) => l.status === "delivered").length || 0
    
    // Calculate revenue from ALL invoices (not just paid)
    let totalRevenue = invoicesData?.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) || 0
    
    // Add revenue from loads if invoices are low/empty
    if (totalRevenue === 0 && loadsWithRevenue) {
      totalRevenue = loadsWithRevenue.reduce((sum, load) => {
        return sum + (parseFloat(load.total_rate) || parseFloat(load.value) || 0)
      }, 0)
    }
    
    const activeTrucks = trucksData?.filter((t) => t.status === "in_use").length || 0
    const activeDrivers = driversData?.filter((d) => d.status === "active").length || 0
    
    const onTimeDeliveries = loadsData?.filter((l) => {
      if (!l.estimated_delivery || !l.actual_delivery) return false
      return new Date(l.actual_delivery) <= new Date(l.estimated_delivery)
    }).length || 0

    const averageRevenuePerLoad = completedLoads > 0 ? totalRevenue / completedLoads : 0

    return {
      data: {
        totalLoads,
        activeLoads,
        completedLoads,
        totalRevenue,
        activeTrucks,
        activeDrivers,
        onTimeDeliveries,
        averageRevenuePerLoad,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to load analytics", data: null }
  }
}

