"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"
import * as Sentry from "@sentry/nextjs"

/**
 * Get analytics dashboard data
 * FIXED: Server-side aggregation with limited column selection to prevent PII exposure
 */
export async function getAnalyticsData(dateRange: number = 30) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // FIXED: Add RBAC check
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
    }

    // V3-014 FIX: Validate input parameters
    if (typeof dateRange !== "number" || dateRange < 1 || dateRange > 365) {
      return { error: "Date range must be between 1 and 365 days", data: null }
    }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRange)

    // FIXED: Select only necessary columns, not all columns (prevents PII exposure)
    // V3-007 FIX: Add LIMIT to prevent unbounded queries
    // Get loads statistics - only count and status fields
    const { data: loadsData, error: loadsError } = await supabase
      .from("loads")
      .select("id, status, estimated_delivery, actual_delivery, created_at")
      .eq("company_id", ctx.companyId)
      .gte("created_at", startDate.toISOString())
      .limit(10000)

    if (loadsError) {
      return { error: loadsError.message, data: null }
    }

    // FIXED: Get trucks statistics - only count and status fields
    // V3-007 FIX: Add LIMIT to prevent unbounded queries
    const { data: trucksData, error: trucksError } = await supabase
      .from("trucks")
      .select("id, status")
      .eq("company_id", ctx.companyId)
      .limit(1000)

    if (trucksError) {
      return { error: trucksError.message, data: null }
    }

    // FIXED: Get drivers statistics - only count and status fields (no PII like SSN, DOB, address)
    // V3-007 FIX: Add LIMIT to prevent unbounded queries
    const { data: driversData, error: driversError } = await supabase
      .from("drivers")
      .select("id, status")
      .eq("company_id", ctx.companyId)
      .limit(1000)

    if (driversError) {
      return { error: driversError.message, data: null }
    }

    // Get invoices for revenue
    // V3-007 FIX: Add LIMIT to prevent unbounded queries
    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoices")
      .select("amount, status, created_at")
      .eq("company_id", ctx.companyId)
      .gte("created_at", startDate.toISOString())
      .limit(10000)

    if (invoicesError) {
      return { error: invoicesError.message, data: null }
    }

    // MEDIUM FIX: Add limit to prevent unbounded queries
    // Get revenue from loads as fallback
    const { data: loadsWithRevenue, error: loadsRevenueError } = await supabase
      .from("loads")
      .select("total_rate, value, created_at")
      .eq("company_id", ctx.companyId)
      .gte("created_at", startDate.toISOString())
      .limit(10000) // Reasonable limit for analytics

    if (loadsRevenueError) {
      return { error: loadsRevenueError.message, data: null }
    }

    // Calculate statistics
    const totalLoads = loadsData?.length || 0
    const activeLoads = loadsData?.filter((l: any) => l.status === "in_transit" || l.status === "scheduled").length || 0
    const completedLoads = loadsData?.filter((l: any) => l.status === "delivered").length || 0
    
    // Calculate revenue from ALL invoices (not just paid)
    // V3-013 FIX: Guard parseFloat against NaN
    let totalRevenue = invoicesData?.reduce((sum: number, inv: any) => {
      const amount = parseFloat(inv.amount)
      return sum + (isNaN(amount) || !isFinite(amount) ? 0 : amount)
    }, 0) || 0
    
    // Add revenue from loads if invoices are low/empty
    if (totalRevenue === 0 && loadsWithRevenue) {
      totalRevenue = loadsWithRevenue.reduce((sum: number, load: any) => {
        const rate = parseFloat(load.total_rate)
        const value = parseFloat(load.value)
        const amount = (!isNaN(rate) && isFinite(rate)) ? rate : ((!isNaN(value) && isFinite(value)) ? value : 0)
        return sum + amount
      }, 0)
    }
    
    const activeTrucks = trucksData?.filter((t: any) => t.status === "in_use").length || 0
    const activeDrivers = driversData?.filter((d: any) => d.status === "active").length || 0
    
    const onTimeDeliveries = loadsData?.filter((l: any) => {
      if (!l.estimated_delivery || !l.actual_delivery) return false
      const actualDate = new Date(l.actual_delivery)
      const estimatedDate = new Date(l.estimated_delivery)
      return !isNaN(actualDate.getTime()) && !isNaN(estimatedDate.getTime()) && actualDate <= estimatedDate
    }).length || 0

    // V3-013 FIX: Guard against division by zero and NaN
    const averageRevenuePerLoad = completedLoads > 0 && isFinite(totalRevenue) 
      ? Math.round((totalRevenue / completedLoads) * 100) / 100 
      : 0

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
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load analytics"), data: null }
  }
}

