"use server"

import { createClient } from "@/lib/supabase/server"
import { fetchAllRowsByIdCursor } from "@/lib/supabase/fetch-all-by-id-cursor"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"
import * as Sentry from "@sentry/nextjs"

type AnalyticsLoadRow = {
  status?: string | null
  estimated_delivery?: string | null
  actual_delivery?: string | null
}

type AnalyticsInvoiceRow = {
  amount?: string | number | null
}

type AnalyticsRevenueLoadRow = {
  total_rate?: string | number | null
  value?: string | number | null
}

type StatusRow = {
  status?: string | null
}

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

    const { rows: loadsData, error: loadsError } = await fetchAllRowsByIdCursor<AnalyticsLoadRow & { id: string; created_at: string }>(
      async ({ lastId, pageSize }) => {
        let q = supabase
          .from("loads")
          .select("id, status, estimated_delivery, actual_delivery, created_at")
          .eq("company_id", ctx.companyId)
          .gte("created_at", startDate.toISOString())
          .order("id", { ascending: true })
          .limit(pageSize)
        if (lastId) q = q.gt("id", lastId)
        return await q
      },
      { warnLabel: "analytics loads" },
    )

    if (loadsError) {
      return { error: loadsError, data: null }
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

    const { rows: invoicesData, error: invoicesError } = await fetchAllRowsByIdCursor<{
      id: string
      amount?: string | number | null
      status?: string | null
      created_at?: string
    }>(
      async ({ lastId, pageSize }) => {
        let q = supabase
          .from("invoices")
          .select("id, amount, status, created_at")
          .eq("company_id", ctx.companyId)
          .gte("created_at", startDate.toISOString())
          .order("id", { ascending: true })
          .limit(pageSize)
        if (lastId) q = q.gt("id", lastId)
        return await q
      },
      { warnLabel: "analytics invoices" },
    )

    if (invoicesError) {
      return { error: invoicesError, data: null }
    }

    const { rows: loadsWithRevenue, error: loadsRevenueError } = await fetchAllRowsByIdCursor<{
      id: string
      total_rate?: string | number | null
      value?: string | number | null
      created_at?: string
    }>(
      async ({ lastId, pageSize }) => {
        let q = supabase
          .from("loads")
          .select("id, total_rate, value, created_at")
          .eq("company_id", ctx.companyId)
          .gte("created_at", startDate.toISOString())
          .order("id", { ascending: true })
          .limit(pageSize)
        if (lastId) q = q.gt("id", lastId)
        return await q
      },
      { warnLabel: "analytics loads revenue fallback" },
    )

    if (loadsRevenueError) {
      return { error: loadsRevenueError, data: null }
    }

    // Calculate statistics
    const totalLoads = loadsData?.length || 0
    const typedLoads = (loadsData || []) as AnalyticsLoadRow[]
    const activeLoads = typedLoads.filter((l) => l.status === "in_transit" || l.status === "scheduled").length || 0
    const completedLoads = typedLoads.filter((l) => l.status === "delivered").length || 0
    
    // Calculate revenue from ALL invoices (not just paid)
    // V3-013 FIX: Guard parseFloat against NaN
    let totalRevenue = ((invoicesData || []) as AnalyticsInvoiceRow[]).reduce((sum: number, inv) => {
      const amount = parseFloat(String(inv.amount ?? 0))
      return sum + (isNaN(amount) || !isFinite(amount) ? 0 : amount)
    }, 0) || 0
    
    // Add revenue from loads if invoices are low/empty
    if (totalRevenue === 0 && loadsWithRevenue) {
      totalRevenue = ((loadsWithRevenue || []) as AnalyticsRevenueLoadRow[]).reduce((sum: number, load) => {
        const rate = parseFloat(String(load.total_rate ?? 0))
        const value = parseFloat(String(load.value ?? 0))
        const amount = (!isNaN(rate) && isFinite(rate)) ? rate : ((!isNaN(value) && isFinite(value)) ? value : 0)
        return sum + amount
      }, 0)
    }
    
    const activeTrucks = ((trucksData || []) as StatusRow[]).filter((t) => t.status === "in_use").length || 0
    const activeDrivers = ((driversData || []) as StatusRow[]).filter((d) => d.status === "active").length || 0
    
    const onTimeDeliveries = typedLoads.filter((l) => {
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

