"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getAuthCompany, getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import { canViewFeature, isFeatureMasked } from "@/lib/feature-permissions"
import { getDriverDashboardSnapshot } from "@/app/actions/driver-dashboard"
import type { DriverDashboardSnapshot } from "@/lib/types/driver-dashboard"
import { cacheKeys } from "@/lib/cache"
import * as Sentry from "@sentry/nextjs"
import type {
  DashboardCardDriverRow,
  DashboardCardLoadRow,
  DashboardCardRouteRow,
  DashboardCardTruckRow,
  DashboardStats,
  ExpenseAmountRow,
  InvoiceAmountRow,
  LoadRevenueRow,
  LoadStatusRow,
  MaintenanceAlertRow,
  OverdueInvoiceAlertRow,
  RecentAddressBookActivityRow,
  RecentBolActivityRow,
  RecentCustomerActivityRow,
  RecentDocumentActivityRow,
  RecentDriverActivityRow,
  RecentDvirActivityRow,
  RecentGeofenceActivityRow,
  RecentInvoiceActivityRow,
  RecentLoadActivityRow,
  RecentMaintenanceActivityRow,
  RecentRouteActivityRow,
  RecentSettlementActivityRow,
  RecentTruckActivityRow,
  RecentVendorActivityRow,
  UpcomingDeliveryRow,
} from "@/lib/types/dashboard-stats"

type AuthRaceResult =
  | Awaited<ReturnType<typeof getCachedAuthContext>>
  | { companyId: null; error: string }

type SupabaseCountHead = { count: number | null }

function applyRoleBasedDashboardVisibility(role: EmployeeRole | null, data: DashboardStats): DashboardStats {
  if (!role) return data

  const canSeeAccounting = canViewFeature(role, "accounting") && !isFeatureMasked(role, "accounting")
  if (canSeeAccounting) return data

  const financialActivityKeywords = ["invoice", "settlement", "payment", "revenue", "profit", "expense"]
  const filteredRecentActivity = (data.recentActivity || []).filter((entry) => {
    const text = `${entry.action} ${entry.type}`.toLowerCase()
    return !financialActivityKeywords.some((keyword) => text.includes(keyword))
  })

  return {
    ...data,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    outstandingInvoices: 0,
    revenueTrend: [],
    overdueInvoices: [],
    recentActivity: filteredRecentActivity,
  }
}

/**
 * FAST dashboard stats - optimized for speed with aggressive timeouts
 */
export async function getDashboardStats(): Promise<{ data: DashboardStats; error: string | null }> {
  try {
    // Try to create Supabase client with error handling
    let supabase
    try {
      supabase = await createClient()
    } catch (clientError: unknown) {
      // Only log in development to improve performance
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(clientError)
      }
      const connectErr = errorMessage(clientError, "Failed to connect to database")
      
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
        error: connectErr.includes('Missing Supabase') 
          ? "Database configuration error. Please check your Supabase settings."
          : connectErr.includes('timeout') || connectErr.includes('ECONNREFUSED')
          ? "Connection failed. Please check your internet connection."
          : "Database connection error. Please try again.",
      }
    }

    // Get authenticated user and company_id (cached per request)
    const authPromise = getCachedAuthContext()
    const authTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve({ companyId: null, error: "Connection timeout. Please check your internet connection." })
      }, 5000) // Reduced to 5 seconds for faster failure detection
    })

    const authOutcome = (await Promise.race([authPromise, authTimeout])) as AuthRaceResult
    const { companyId, error: authError } = authOutcome

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

    const cacheKey = cacheKeys.dashboardStats(companyId)
    const { getCachedApiResult, setCachedApiResult } = await import("@/lib/api-protection")
    const cached = await getCachedApiResult<DashboardStats>(cacheKey, 60)
    if (cached) {
      return { data: cached, error: null }
    }

    // Get counts for all entities - optimized to use count queries instead of fetching data
    let countResults: SupabaseCountHead[] = []
    try {
      countResults = await Promise.all([
        // Total counts
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["active", "on_route"]),
        supabase.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["available", "in_use"]),
        supabase.from("routes").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("routes").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["in_progress", "scheduled"]),
        supabase.from("loads").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("loads").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "in_transit"),
        supabase.from("maintenance").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("maintenance").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["scheduled", "overdue"]),
      ])
    } catch (countError) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(countError)
      }
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

    // Get recent activity - fetch ALL platform activities in parallel with timeout protection
    const activityPromise = Promise.all([
      // Existing activities
      supabase.from("loads").select("shipment_number, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("drivers").select("name, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("maintenance").select("service_type, scheduled_date, status, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("routes").select("name, created_at, status, updated_at").eq("company_id", companyId).order("updated_at", { ascending: false }).limit(2),
      supabase.from("invoices").select("invoice_number, created_at, status, amount").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      supabase.from("settlements").select("created_at, status, net_pay, drivers(name)").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // New activities - Address Book
      supabase.from("address_book").select("name, created_at, category").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // Trucks/Vehicles
      supabase.from("trucks").select("truck_number, created_at, status, make, model").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // Customers
      supabase.from("customers").select("name, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // Vendors
      supabase.from("vendors").select("name, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // Documents
      supabase.from("documents").select("name, created_at, document_type").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // BOLs
      supabase.from("bols").select("bol_number, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // DVIR
      supabase.from("dvir").select("id, created_at, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
      // Geofences
      supabase.from("geofences").select("name, created_at, is_active").eq("company_id", companyId).order("created_at", { ascending: false }).limit(2),
    ]).catch((error) => {
      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(error)
      }
      // Return empty arrays if query fails
      return Array(14).fill({ data: [] })
    })

    const activityTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve(Array(14).fill({ data: [] }))
      }, 5000) // 5 seconds timeout
    })

    let recentLoads: RecentLoadActivityRow[] = []
    let recentDrivers: RecentDriverActivityRow[] = []
    let recentMaintenance: RecentMaintenanceActivityRow[] = []
    let recentRoutes: RecentRouteActivityRow[] = []
    let recentInvoices: RecentInvoiceActivityRow[] = []
    let recentSettlements: RecentSettlementActivityRow[] = []
    let recentAddressBook: RecentAddressBookActivityRow[] = []
    let recentTrucks: RecentTruckActivityRow[] = []
    let recentCustomers: RecentCustomerActivityRow[] = []
    let recentVendors: RecentVendorActivityRow[] = []
    let recentDocuments: RecentDocumentActivityRow[] = []
    let recentBols: RecentBolActivityRow[] = []
    let recentDvir: RecentDvirActivityRow[] = []
    let recentGeofences: RecentGeofenceActivityRow[] = []

    try {
      const results = (await Promise.race([activityPromise, activityTimeout])) as Array<{ data: unknown }>
      recentLoads = (results[0]?.data as RecentLoadActivityRow[]) || []
      recentDrivers = (results[1]?.data as RecentDriverActivityRow[]) || []
      recentMaintenance = (results[2]?.data as RecentMaintenanceActivityRow[]) || []
      recentRoutes = (results[3]?.data as RecentRouteActivityRow[]) || []
      recentInvoices = (results[4]?.data as RecentInvoiceActivityRow[]) || []
      recentSettlements = (results[5]?.data as RecentSettlementActivityRow[]) || []
      recentAddressBook = (results[6]?.data as RecentAddressBookActivityRow[]) || []
      recentTrucks = (results[7]?.data as RecentTruckActivityRow[]) || []
      recentCustomers = (results[8]?.data as RecentCustomerActivityRow[]) || []
      recentVendors = (results[9]?.data as RecentVendorActivityRow[]) || []
      recentDocuments = (results[10]?.data as RecentDocumentActivityRow[]) || []
      recentBols = (results[11]?.data as RecentBolActivityRow[]) || []
      recentDvir = (results[12]?.data as RecentDvirActivityRow[]) || []
      recentGeofences = (results[13]?.data as RecentGeofenceActivityRow[]) || []
      
    } catch (error) {
      // If there's an error, use empty arrays
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(error)
      }
    }

    // Build recent activity array
    const recentActivity: Array<{ action: string; time: string; type: string }> = []

    // Process loads
    if (Array.isArray(recentLoads) && recentLoads.length > 0) {
      recentLoads.forEach((load) => {
        if (load && load.created_at) {
          recentActivity.push({
            action: `Load ${load.shipment_number || 'N/A'} ${load.status === "in_transit" ? "is in transit" : load.status === "delivered" ? "was delivered" : "was created"}`,
            time: load.created_at,
            type: load.status === "delivered" ? "success" : load.status === "in_transit" ? "info" : "default",
          })
        }
      })
    }

    // Process drivers
    if (Array.isArray(recentDrivers) && recentDrivers.length > 0) {
      recentDrivers.forEach((driver) => {
        if (driver && driver.created_at) {
          recentActivity.push({
            action: `Driver ${driver.name || 'Unknown'} was ${driver.status === "active" ? "added" : "updated"}`,
            time: driver.created_at,
            type: "success",
          })
        }
      })
    }

    // Process maintenance
    if (Array.isArray(recentMaintenance) && recentMaintenance.length > 0) {
      recentMaintenance.forEach((maint) => {
        if (maint && maint.created_at) {
          const date = maint.scheduled_date ? new Date(maint.scheduled_date).toLocaleDateString() : "TBD"
          recentActivity.push({
            action: `Maintenance for ${maint.service_type || 'Unknown'} scheduled for ${date}`,
            time: maint.created_at,
            type: maint.status === "overdue" ? "error" : maint.status === "completed" ? "success" : "warning",
          })
        }
      })
    }

    // Process routes
    if (Array.isArray(recentRoutes) && recentRoutes.length > 0) {
      recentRoutes.forEach((route) => {
        if (route && (route.created_at || route.updated_at)) {
          recentActivity.push({
            action: `Route ${route.name || 'Unknown'} was ${route.status === "completed" ? "completed" : route.status === "in_progress" ? "started" : "created"}`,
            time: String(route.updated_at ?? route.created_at ?? ""),
            type: route.status === "completed" ? "success" : route.status === "in_progress" ? "info" : "default",
          })
        }
      })
    }

    // Process invoices
    if (Array.isArray(recentInvoices) && recentInvoices.length > 0) {
      recentInvoices.forEach((invoice) => {
        if (invoice && invoice.created_at) {
          const amount = invoice.amount ? Number(invoice.amount).toFixed(2) : "0.00"
          recentActivity.push({
            action: `Invoice ${invoice.invoice_number || 'N/A'} for $${amount} was ${invoice.status === "paid" ? "paid" : invoice.status === "sent" ? "sent" : "created"}`,
            time: invoice.created_at,
            type: invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "error" : "info",
          })
        }
      })
    }

    // Process settlements
    if (Array.isArray(recentSettlements) && recentSettlements.length > 0) {
      recentSettlements.forEach((settlement: RecentSettlementActivityRow) => {
        if (settlement && settlement.created_at) {
          const driverName = settlement.drivers?.name || "Driver"
          const netPay = settlement.net_pay ? Number(settlement.net_pay).toFixed(2) : "0.00"
          recentActivity.push({
            action: `Settlement for ${driverName} ($${netPay}) was ${settlement.status === "paid" ? "paid" : "created"}`,
            time: settlement.created_at,
            type: settlement.status === "paid" ? "success" : "info",
          })
        }
      })
    }

    // Process address book entries
    if (Array.isArray(recentAddressBook) && recentAddressBook.length > 0) {
      recentAddressBook.forEach((entry) => {
        if (entry && entry.created_at) {
          const categoryLabels: Record<string, string> = {
            shipper: "Shipper",
            receiver: "Receiver",
            vendor: "Vendor",
            broker: "Broker",
            driver: "Driver",
            warehouse: "Warehouse",
            repair_shop: "Repair Shop",
            fuel_station: "Fuel Station",
            other: "Address",
          }
          const categoryKey = entry.category ?? "other"
          const categoryLabel = categoryLabels[categoryKey] || "Address"
          recentActivity.push({
            action: `${categoryLabel} address "${entry.name || 'Unknown'}" was added to address book`,
            time: entry.created_at,
            type: "success",
          })
        }
      })
    }

    // Process trucks/vehicles
    if (Array.isArray(recentTrucks) && recentTrucks.length > 0) {
      recentTrucks.forEach((truck) => {
        if (truck && truck.created_at) {
          const truckInfo = truck.make && truck.model ? `${truck.make} ${truck.model}` : truck.truck_number || 'Unknown'
          recentActivity.push({
            action: `Truck ${truck.truck_number || truckInfo} was ${truck.status === "active" ? "added" : "updated"}`,
            time: truck.created_at,
            type: truck.status === "active" || truck.status === "available" ? "success" : "info",
          })
        }
      })
    }

    // Process customers
    if (Array.isArray(recentCustomers) && recentCustomers.length > 0) {
      recentCustomers.forEach((customer) => {
        if (customer && customer.created_at) {
          recentActivity.push({
            action: `Customer "${customer.name || 'Unknown'}" was ${customer.status === "active" ? "added" : "updated"}`,
            time: customer.created_at,
            type: customer.status === "active" ? "success" : "info",
          })
        }
      })
    }

    // Process vendors
    if (Array.isArray(recentVendors) && recentVendors.length > 0) {
      recentVendors.forEach((vendor) => {
        if (vendor && vendor.created_at) {
          recentActivity.push({
            action: `Vendor "${vendor.name || 'Unknown'}" was ${vendor.status === "active" ? "added" : "updated"}`,
            time: vendor.created_at,
            type: vendor.status === "active" ? "success" : "info",
          })
        }
      })
    }

    // Process documents
    if (Array.isArray(recentDocuments) && recentDocuments.length > 0) {
      recentDocuments.forEach((doc) => {
        if (doc && doc.created_at) {
          recentActivity.push({
            action: `Document "${doc.name || 'Unknown'}" (${doc.document_type || 'file'}) was uploaded`,
            time: doc.created_at,
            type: "info",
          })
        }
      })
    }

    // Process BOLs
    if (Array.isArray(recentBols) && recentBols.length > 0) {
      recentBols.forEach((bol) => {
        if (bol && bol.created_at) {
          recentActivity.push({
            action: `BOL ${bol.bol_number || 'N/A'} was ${bol.status === "completed" ? "completed" : bol.status === "sent" ? "sent" : "created"}`,
            time: bol.created_at,
            type: bol.status === "completed" ? "success" : bol.status === "sent" ? "info" : "default",
          })
        }
      })
    }

    // Process DVIR
    if (Array.isArray(recentDvir) && recentDvir.length > 0) {
      recentDvir.forEach((dvir) => {
        if (dvir && dvir.created_at) {
          recentActivity.push({
            action: `DVIR inspection was ${dvir.status === "completed" ? "completed" : dvir.status === "submitted" ? "submitted" : "created"}`,
            time: dvir.created_at,
            type: dvir.status === "completed" ? "success" : dvir.status === "needs_repair" ? "warning" : "info",
          })
        }
      })
    }

    // Process geofences
    if (Array.isArray(recentGeofences) && recentGeofences.length > 0) {
      recentGeofences.forEach((geofence) => {
        if (geofence && geofence.created_at) {
          recentActivity.push({
            action: `Geofence "${geofence.name || 'Unknown'}" was ${geofence.is_active ? "created" : "deactivated"}`,
            time: geofence.created_at,
            type: geofence.is_active ? "success" : "warning",
          })
        }
      })
    }

    // Sort by time (most recent first) and limit to 5
    // Filter out invalid dates before sorting
    const validActivities = recentActivity.filter((activity) => {
      if (!activity.time) return false
      try {
        const date = new Date(activity.time)
        return !isNaN(date.getTime())
      } catch {
        return false
      }
    })
    
    validActivities.sort((a, b) => {
      try {
        const timeA = new Date(a.time).getTime()
        const timeB = new Date(b.time).getTime()
        return timeB - timeA // Most recent first
      } catch {
        return 0
      }
    })
    
    const sortedRecentActivity = validActivities.slice(0, 5)

    // Get sample data for dashboard cards - fetch in parallel for speed (with timeout)
    const cardQueries = Promise.all([
      supabase.from("drivers").select("id, name, status, phone").eq("company_id", companyId).in("status", ["active", "on_route"]).order("created_at", { ascending: false }).limit(3),
      supabase.from("trucks").select("id, truck_number, make, model, status").eq("company_id", companyId).in("status", ["available", "in_use"]).order("created_at", { ascending: false }).limit(3),
      supabase.from("routes").select("id, name, origin, destination, status").eq("company_id", companyId).in("status", ["in_progress", "scheduled"]).order("updated_at", { ascending: false }).limit(3),
      supabase.from("loads").select("id, shipment_number, origin, destination, status").eq("company_id", companyId).order("created_at", { ascending: false }).limit(3),
    ])
    
    const cardTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout. Please check your internet connection.")), 5000) // Reduced to 5 seconds for faster failure
    })
    
    let recentDriversData: DashboardCardDriverRow[] | null = null
    let recentTrucksData: DashboardCardTruckRow[] | null = null
    let recentRoutesData: DashboardCardRouteRow[] | null = null
    let recentLoadsData: DashboardCardLoadRow[] | null = null
    
    try {
      const results = (await Promise.race([cardQueries, cardTimeout])) as Array<{ data: unknown }>
      recentDriversData = (results[0]?.data as DashboardCardDriverRow[]) ?? null
      recentTrucksData = (results[1]?.data as DashboardCardTruckRow[]) ?? null
      recentRoutesData = (results[2]?.data as DashboardCardRouteRow[]) ?? null
      recentLoadsData = (results[3]?.data as DashboardCardLoadRow[]) ?? null
    } catch (error) {
      // If timeout, continue with empty arrays
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureMessage("Card data queries timed out, using empty data", "warning")
      }
    }

    // Get financial metrics (with timeout protection)
    // MEDIUM FIX: Add date range filter and limits to prevent full-table scans
    // Use last 12 months for financial data (reasonable for dashboard)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    const financialPromise = Promise.all([
      supabase.from("invoices").select("amount, status, issue_date, created_at").eq("company_id", companyId).gte("created_at", twelveMonthsAgo.toISOString()).limit(10000),
      supabase.from("expenses").select("amount, date").eq("company_id", companyId).gte("date", twelveMonthsAgo.toISOString().split('T')[0]).limit(10000),
      supabase.from("invoices").select("amount, status, due_date").eq("company_id", companyId).in("status", ["sent", "overdue"]).limit(1000),
      supabase.from("loads").select("total_rate, value, created_at").eq("company_id", companyId).gte("created_at", twelveMonthsAgo.toISOString()).limit(10000),
    ]).catch(() => {
      return [
        { data: [] },
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
          { data: [] },
        ])
      }, 2000) // Reduced to 2 seconds for faster failure
    })

    const financialOutcome = (await Promise.race([financialPromise, financialTimeout])) as [
      { data: InvoiceAmountRow[] | null },
      { data: ExpenseAmountRow[] | null },
      { data: InvoiceAmountRow[] | null },
      { data: LoadRevenueRow[] | null },
    ]
    const [{ data: allInvoices }, { data: expenses }, { data: pendingInvoices }, { data: loads }] = financialOutcome

    // Calculate financial metrics - combine invoices and loads
    let totalRevenue = allInvoices?.reduce((sum: number, inv: InvoiceAmountRow) => sum + (Number(inv.amount) || 0), 0) || 0
    
    // Add revenue from loads
    if (loads) {
      const loadRevenue = loads.reduce((sum: number, load: LoadRevenueRow) => {
        return sum + (Number(load.total_rate) || Number(load.value) || 0)
      }, 0)
      totalRevenue += loadRevenue
    }
    
    const totalExpenses = expenses?.reduce((sum: number, exp: ExpenseAmountRow) => sum + (Number(exp.amount) || 0), 0) || 0
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0
    const outstandingInvoices = pendingInvoices?.reduce((sum: number, inv: InvoiceAmountRow) => sum + (Number(inv.amount) || 0), 0) || 0

    // Get revenue trend data (last 7 days) - match chart title
    let revenueTrendData: Array<{ date: string; amount: number }> = []
    try {
      const now = new Date()
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0) // Start of day
      
      // MEDIUM FIX: Add limits to prevent unbounded queries (even with date range)
      // Get ALL invoices (not just paid) - use created_at for reliable date
      const { data: invoices } = await supabase
        .from("invoices")
        .select("amount, created_at, issue_date")
        .eq("company_id", companyId)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000) // Reasonable limit for 7 days of data
      
      // Also get revenue from loads as fallback
      const { data: loadsForTrend } = await supabase
        .from("loads")
        .select("created_at, total_rate, value")
        .eq("company_id", companyId)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000) // Reasonable limit for 7 days of data

      // Group revenue by date
      const revenueByDate: Record<string, number> = {}
      
      // Process invoices - use created_at as primary date
      if (invoices && invoices.length > 0) {
        invoices.forEach((inv: InvoiceAmountRow) => {
          let dateStr = ''
          if (inv.created_at) {
            const date = new Date(inv.created_at)
            dateStr = date.toISOString().split('T')[0]
          } else if (inv.issue_date) {
            const date = new Date(inv.issue_date)
            dateStr = date.toISOString().split('T')[0]
          }
          
          if (dateStr) {
            const amount = Number(inv.amount) || 0
            if (amount > 0) {
              revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + amount
            }
          }
        })
      }
      
      // Process loads - combine with invoice data
      if (loadsForTrend && loadsForTrend.length > 0) {
        loadsForTrend.forEach((load: LoadRevenueRow) => {
          if (load.created_at) {
            const date = new Date(load.created_at)
            const dateStr = date.toISOString().split('T')[0]
            const amount = Number(load.total_rate) || Number(load.value) || 0
            if (amount > 0) {
              // Add load revenue (invoices take priority, but loads supplement)
              revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + amount
            }
          }
        })
      }

      // Generate data for last 7 days (even if no revenue on some days)
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        const dateStr = date.toISOString().split('T')[0]
        revenueTrendData.push({
          date: dateStr,
          amount: revenueByDate[dateStr] || 0
        })
      }
    } catch (error) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(error)
      }
      // Generate empty data for last 7 days if error occurs
      const now = new Date()
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        revenueTrendData.push({
          date: date.toISOString().split('T')[0],
          amount: 0
        })
      }
    }

    // MEDIUM FIX: Add limit to prevent unbounded query
    // Get load status distribution
    let allLoads: LoadStatusRow[] = []
    try {
      const loadStatusResult = await supabase
        .from("loads")
        .select("status")
        .eq("company_id", companyId)
        .limit(10000) // Reasonable limit for status distribution
        
      allLoads = loadStatusResult.data || []
    } catch (error) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(error)
      }
      allLoads = []
    }

    // Count loads by status
    const loadStatusCounts: Record<string, number> = {}
    allLoads?.forEach((load: LoadStatusRow) => {
      const status = load.status || 'unknown'
      loadStatusCounts[status] = (loadStatusCounts[status] || 0) + 1
    })

    // Get critical alerts
    let upcomingMaintenance: MaintenanceAlertRow[] = []
    let overdueInvoices: OverdueInvoiceAlertRow[] = []
    let upcomingDeliveries: UpcomingDeliveryRow[] = []
    
    try {
      const alertsResults = await Promise.all([
        supabase.from("maintenance")
          .select("id, service_type, scheduled_date, status")
          .eq("company_id", companyId)
          .in("status", ["overdue", "scheduled"])
          .lte("scheduled_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(5)
          .then((res: { data: unknown }) => res)
          .catch(() => ({ data: [], error: null })),
        supabase.from("invoices")
          .select("id, invoice_number, due_date, amount, status")
          .eq("company_id", companyId)
          .eq("status", "overdue")
          .limit(5)
          .then((res: { data: unknown }) => res)
          .catch(() => ({ data: [], error: null })),
        supabase.from("loads")
          .select("id, shipment_number, estimated_delivery, status")
          .eq("company_id", companyId)
          .eq("status", "in_transit")
          .lte("estimated_delivery", new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())
          .limit(5)
          .then((res: { data: unknown }) => res)
          .catch(() => ({ data: [], error: null })),
      ])
      
      upcomingMaintenance = (alertsResults[0]?.data as MaintenanceAlertRow[] | null) ?? []
      overdueInvoices = (alertsResults[1]?.data as OverdueInvoiceAlertRow[] | null) ?? []
      upcomingDeliveries = (alertsResults[2]?.data as UpcomingDeliveryRow[] | null) ?? []
    } catch (error) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        Sentry.captureException(error)
      }
      // Use empty arrays if alerts fail
    }


    const dashboardData: DashboardStats = {
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
      revenueTrend: revenueTrendData,
      loadStatusDistribution: Object.entries(loadStatusCounts).map(([status, count]) => ({ status, count })),
      // Alerts
      upcomingMaintenance: upcomingMaintenance || [],
      overdueInvoices: overdueInvoices || [],
      upcomingDeliveries: upcomingDeliveries || [],
    }

    await setCachedApiResult(cacheKey, dashboardData, 60)

    return {
      data: dashboardData,
      error: null,
    }
  } catch (error: unknown) {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      Sentry.captureException(error)
    }
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

/**
 * One server action for the dashboard home: company + stats together.
 * Drivers get a compliance snapshot only — no fleet financial aggregates.
 */
export async function getDashboardBootstrap(): Promise<{
  authCompany: { companyId: string; companyName: string | null } | null
  authError: string | null
  userRole: EmployeeRole | null
  dashboardData: DashboardStats | null
  driverDashboard: DriverDashboardSnapshot | null
  dashboardError: string | null
}> {
  const [auth, ctx] = await Promise.all([getAuthCompany(), getCachedAuthContext()])

  const userRole = ctx.user ? mapLegacyRole(ctx.user.role) : null

  if (userRole === "driver") {
    const driverDashboard = await getDriverDashboardSnapshot()
    return {
      authCompany:
        auth.companyId != null
          ? { companyId: auth.companyId, companyName: auth.companyName }
          : null,
      authError: auth.error ?? null,
      userRole,
      dashboardData: null,
      driverDashboard: driverDashboard.data,
      dashboardError: driverDashboard.error,
    }
  }

  const stats = await getDashboardStats()
  const shapedDashboardData = applyRoleBasedDashboardVisibility(userRole, stats.data)
  return {
    authCompany:
      auth.companyId != null
        ? { companyId: auth.companyId, companyName: auth.companyName }
        : null,
    authError: auth.error ?? null,
    userRole,
    dashboardData: shapedDashboardData,
    driverDashboard: null,
    dashboardError: stats.error,
  }
}
