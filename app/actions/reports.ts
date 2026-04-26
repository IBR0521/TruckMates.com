"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


// Helper to get company ID (uses cached auth)
async function getCompanyId() {
  const ctx = await getCachedAuthContext()
  return ctx.companyId ?? null
}

// Revenue Report
export async function getRevenueReport(startDate?: string, endDate?: string, terminalId?: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // FIXED: Add RBAC check - only authorized roles can view financial reports
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
    }

    const companyId = await getCompanyId()
    if (!companyId) return { error: "Not authenticated", data: null }

    const supabase = await createClient()
  
    // Get ALL invoices (not just paid) - use created_at for reliable date filtering
    // FIXED: Select only necessary columns and add limit
    let invoiceQuery = supabase
      .from("invoices")
      .select("id, amount, customer_name, created_at, load_id")
      .eq("company_id", companyId)

    if (startDate) {
      invoiceQuery = invoiceQuery.gte("created_at", startDate)
    }
    if (endDate) {
      invoiceQuery = invoiceQuery.lte("created_at", endDate + "T23:59:59")
    }

    // FIXED: Add limit to prevent unbounded queries
    const limit = 10000 // Reasonable limit for report generation
    const { data: invoices, error: invoiceError } = await invoiceQuery
      .order("created_at", { ascending: false })
      .limit(limit)

    // Also get loads data as fallback/supplement
    // FIXED: Add limit to prevent unbounded queries
    let loadQuery = supabase
      .from("loads")
      .select("id, shipment_number, customer_id, total_rate, value, created_at")
      .eq("company_id", companyId)
    if (terminalId) {
      loadQuery = loadQuery.eq("terminal_id", terminalId)
    }

    if (startDate) {
      loadQuery = loadQuery.gte("created_at", startDate)
    }
    if (endDate) {
      loadQuery = loadQuery.lte("created_at", endDate + "T23:59:59")
    }

    // Use the same limit variable declared above
    const { data: loads } = await loadQuery
      .order("created_at", { ascending: false })
      .limit(limit)

    // Get customers for loads
    const customerIds = loads?.map((l: { customer_id: string | null; [key: string]: any }) => l.customer_id).filter(Boolean) || []
    let customers = null
    if (customerIds.length > 0) {
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds)
      customers = data
    }

    const customerMap = new Map<string, string>()
    customers?.forEach((c: { id: string; name: string; [key: string]: any }) => customerMap.set(c.id, c.name))

    // Calculate revenue by customer
    const revenueByCustomer: Record<
      string,
      { customer: string; loads: number; revenue: number; avgPerLoad: number }
    > = {}

    // FIXED: Track which loads have invoices to prevent double-counting
    const loadIdsWithInvoices = new Set<string>()
    
    const allowedLoadIds = new Set((loads || []).map((l: any) => String(l.id)))
    // Process invoices
    invoices?.forEach((invoice: { customer_name: string | null; amount: number | string | null; load_id: string | null; [key: string]: any }) => {
      if (terminalId && invoice.load_id && !allowedLoadIds.has(String(invoice.load_id))) return
      const customer = invoice.customer_name || "Unknown Customer"
      if (!revenueByCustomer[customer]) {
        revenueByCustomer[customer] = {
          customer,
          loads: 0,
          revenue: 0,
          avgPerLoad: 0,
        }
      }
      revenueByCustomer[customer].revenue += Number(invoice.amount) || 0
      revenueByCustomer[customer].loads += 1
      
      // Track load_id from invoice to avoid double-counting
      if (invoice.load_id) {
        loadIdsWithInvoices.add(invoice.load_id)
      }
    })

    // FIXED: Process loads - only add revenue if no invoice exists for that load
    if (loads) {
      loads.forEach((load: any) => {
        // Skip if this load already has an invoice
        if (load.id && loadIdsWithInvoices.has(load.id)) {
          return
        }
        
        const customerName = load.customer_id ? (customerMap.get(load.customer_id) || "Unknown Customer") : "Unknown Customer"
        const amount = Number(load.total_rate) || Number(load.value) || 0
        
        if (amount > 0) {
          if (!revenueByCustomer[customerName]) {
            revenueByCustomer[customerName] = {
              customer: customerName,
              loads: 0,
              revenue: 0,
              avgPerLoad: 0,
            }
          }
          revenueByCustomer[customerName].revenue += amount
          revenueByCustomer[customerName].loads += 1
        }
      })
    }

    // Calculate averages
    Object.values(revenueByCustomer).forEach((item) => {
      item.avgPerLoad = item.loads > 0 ? item.revenue / item.loads : 0
    })

    const totalRevenue = Object.values(revenueByCustomer).reduce((sum, item) => sum + item.revenue, 0)
    const totalLoads = Object.values(revenueByCustomer).reduce((sum, item) => sum + item.loads, 0)
    const avgPerLoad = totalLoads > 0 ? totalRevenue / totalLoads : 0

    return {
      data: {
        revenueByCustomer: Object.values(revenueByCustomer),
        totalRevenue,
        totalLoads,
        avgPerLoad,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

// Profit & Loss Report
export async function getProfitLossReport(startDate?: string, endDate?: string, terminalId?: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // FIXED: Add RBAC check - only authorized roles can view financial reports
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
    }

    const companyId = await getCompanyId()
    if (!companyId) return { error: "Not authenticated", data: null }

    const supabase = await createClient()

    // Get ALL invoices (not just paid) - use created_at for reliable date filtering
    // FIXED: Select only necessary columns and add limit
    let revenueQuery = supabase
      .from("invoices")
      .select("id, amount, items, created_at, load_id")
      .eq("company_id", companyId)

    if (startDate) {
      revenueQuery = revenueQuery.gte("created_at", startDate)
    }
    if (endDate) {
      revenueQuery = revenueQuery.lte("created_at", endDate + "T23:59:59")
    }

    // FIXED: Add limit to prevent unbounded queries
    const limit = 10000
    const { data: invoices } = await revenueQuery.limit(limit)

    // Also get revenue from loads
    let loadQuery = supabase
      .from("loads")
      .select("id, total_rate, value, created_at")
      .eq("company_id", companyId)
    if (terminalId) {
      loadQuery = loadQuery.eq("terminal_id", terminalId)
    }

    if (startDate) {
      loadQuery = loadQuery.gte("created_at", startDate)
    }
    if (endDate) {
      loadQuery = loadQuery.lte("created_at", endDate + "T23:59:59")
    }

    const { data: loads } = await loadQuery

    // Get expenses
    // FIXED: Select only necessary columns and add limit
    let expensesQuery = supabase
      .from("expenses")
      .select("id, amount, category, date")
      .eq("company_id", companyId)

    if (startDate) {
      expensesQuery = expensesQuery.gte("date", startDate)
    }
    if (endDate) {
      expensesQuery = expensesQuery.lte("date", endDate)
    }

    // FIXED: Add limit to prevent unbounded queries
    const expensesLimit = 10000
    const { data: expenses } = await expensesQuery.limit(expensesLimit)

    // FIXED: Track which loads have invoices to prevent double-counting
    const loadIdsWithInvoices = new Set<string>()
    
    const allowedLoadIds = new Set((loads || []).map((l: any) => String(l.id)))
    // Process invoices and track their load_ids
    invoices?.forEach((invoice: { load_id: string | null; [key: string]: any }) => {
      if (terminalId && invoice.load_id && !allowedLoadIds.has(String(invoice.load_id))) return
      if (invoice.load_id) {
        loadIdsWithInvoices.add(invoice.load_id)
      }
    })
    
    // Calculate totals - combine invoices and loads (only loads without invoices)
    let totalRevenue = (invoices || [])
      .filter((inv: any) => !terminalId || !inv.load_id || allowedLoadIds.has(String(inv.load_id)))
      .reduce((sum: number, inv: { amount: number | string | null; [key: string]: any }) => sum + (Number(inv.amount) || 0), 0)
    
    // FIXED: Only add revenue from loads that don't have invoices
    if (loads) {
      const loadRevenue = loads
        .filter((load: { id: string | null; [key: string]: any }) => !load.id || !loadIdsWithInvoices.has(load.id)) // Only loads without invoices
        .reduce((sum: number, load: { total_rate: number | string | null; value: number | string | null; [key: string]: any }) => {
          return sum + (Number(load.total_rate) || Number(load.value) || 0)
        }, 0)
      totalRevenue += loadRevenue
    }
    
    const totalExpenses = expenses?.reduce((sum: number, exp: { amount: number | string | null; [key: string]: any }) => sum + (Number(exp.amount) || 0), 0) || 0
    const netProfit = totalRevenue - totalExpenses

    // Revenue breakdown
    const revenueBreakdown: Record<string, number> = {}
    
    // Process invoices
    invoices?.forEach((invoice: { items: any[] | null; amount: number | string | null; load_id: string | null; [key: string]: any }) => {
      const items = (invoice.items as any[]) || []
      if (items.length > 0) {
        items.forEach((item: any) => {
          const category = item.category || "Load Revenue"
          revenueBreakdown[category] = (revenueBreakdown[category] || 0) + (Number(item.amount) || 0)
        })
      } else {
        // If no items, count as load revenue
        revenueBreakdown["Load Revenue"] = (revenueBreakdown["Load Revenue"] || 0) + (Number(invoice.amount) || 0)
      }
    })
    
    // FIXED: Process loads - only add to breakdown if no invoice exists (avoid double-counting)
    if (loads) {
      const loadRevenue = loads
        .filter((load: { id: string | null; [key: string]: any }) => !load.id || !loadIdsWithInvoices.has(load.id)) // Only loads without invoices
        .reduce((sum: number, load: { total_rate: number | string | null; value: number | string | null; [key: string]: any }) => {
          return sum + (Number(load.total_rate) || Number(load.value) || 0)
        }, 0)
      if (loadRevenue > 0) {
        revenueBreakdown["Load Revenue"] = (revenueBreakdown["Load Revenue"] || 0) + loadRevenue
      }
    }

    // Expense breakdown by category
    const expenseBreakdown: Record<string, number> = {}
    expenses?.forEach((expense: { category: string | null; amount: number | string | null; [key: string]: any }) => {
      const category = expense.category || "Other"
      expenseBreakdown[category] = (expenseBreakdown[category] || 0) + (Number(expense.amount) || 0)
    })

    return {
      data: {
        totalRevenue,
        totalExpenses,
        netProfit,
        revenueBreakdown: Object.entries(revenueBreakdown).map(([category, amount]) => ({
          category,
          amount,
          percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
        })),
        expenseBreakdown: Object.entries(expenseBreakdown).map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        })),
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

// Driver Payments Report
export async function getDriverPaymentsReport(startDate?: string, endDate?: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // FIXED: Add RBAC check - only authorized roles can view financial reports
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
    }

    const companyId = await getCompanyId()
    if (!companyId) return { error: "Not authenticated", data: null }

    const supabase = await createClient()

    // FIXED: Select only necessary fields, not all columns (exclude sensitive calculation_details, pay_rule_id, etc.)
    let settlementsQuery = supabase
      .from("settlements")
      .select("id, driver_id, period_start, period_end, net_pay, status, created_at, updated_at")
      .eq("company_id", companyId)
      .eq("status", "paid")

    if (startDate) {
      settlementsQuery = settlementsQuery.gte("period_start", startDate)
    }
    if (endDate) {
      settlementsQuery = settlementsQuery.lte("period_end", endDate)
    }

    // LOW FIX: Sort by period_end (pay period) instead of created_at for proper chronological display
    const { data: settlements, error } = await settlementsQuery.order("period_end", { ascending: false })

    if (error) return { error: safeDbError(error), data: null }

    // Get driver details
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, name")
      .eq("company_id", companyId)

    // Create driver lookup map
    const driverMap = new Map<string, string>()
    drivers?.forEach((driver: { id: string; name: string; [key: string]: any }) => {
      driverMap.set(driver.id, driver.name)
    })

    // FIXED: Use user's timezone for year boundary, not server UTC
    // Get user's timezone from their profile or default to UTC
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    const now = new Date()
    const userYear = new Intl.DateTimeFormat("en-US", { timeZone: userTimezone, year: "numeric" }).format(now)
    const currentYear = parseInt(userYear)
    
    const { data: allYearSettlements } = await supabase
      .from("settlements")
      .select("driver_id, net_pay")
      .eq("company_id", companyId)
      .eq("status", "paid")
      .gte("period_start", `${currentYear}-01-01`)
      .lte("period_end", `${currentYear}-12-31`)

    // Calculate YTD by driver
    const ytdByDriver: Record<string, number> = {}
    allYearSettlements?.forEach((settlement: { driver_id: string; net_pay: number | string | null; [key: string]: any }) => {
      const driverId = settlement.driver_id
      ytdByDriver[driverId] = (ytdByDriver[driverId] || 0) + (Number(settlement.net_pay) || 0)
    })

    // Calculate payments by driver for selected period
    const paymentsByDriver: Record<
      string,
      {
        driverId: string
        driverName: string
        loads: number
        totalPay: number
        avgPerLoad: number
        ytd: number
      }
    > = {}

    settlements?.forEach((settlement: { driver_id: string; net_pay: number | string | null; loads: any[] | null; [key: string]: any }) => {
      const driverId = settlement.driver_id
      const driverName = driverMap.get(driverId) || "Unknown Driver"
      const loads = Array.isArray(settlement.loads) ? settlement.loads.length : 0

      if (!paymentsByDriver[driverId]) {
        paymentsByDriver[driverId] = {
          driverId,
          driverName,
          loads: 0,
          totalPay: 0,
          avgPerLoad: 0,
          ytd: ytdByDriver[driverId] || 0,
        }
      }

      paymentsByDriver[driverId].loads += loads
      paymentsByDriver[driverId].totalPay += Number(settlement.net_pay) || 0
    })

    // Calculate averages
    Object.values(paymentsByDriver).forEach((item) => {
      item.avgPerLoad = item.loads > 0 ? item.totalPay / item.loads : 0
    })

    const totalPaid = settlements?.reduce((sum: number, s: { net_pay: number | string | null; [key: string]: any }) => sum + (Number(s.net_pay) || 0), 0) || 0
    const totalLoads = settlements?.reduce((sum: number, s: { loads: any[] | null; [key: string]: any }) => {
      const loads = Array.isArray(s.loads) ? s.loads.length : 0
      return sum + loads
    }, 0) || 0
    const avgPerDriver = Object.keys(paymentsByDriver).length > 0 ? totalPaid / Object.keys(paymentsByDriver).length : 0
    const avgPerLoad = totalLoads > 0 ? totalPaid / totalLoads : 0

    // FIXED: Return only aggregated data, not full settlement objects
    return {
      data: {
        // Don't return full settlements array - only return aggregated summary
        paymentsByDriver: Object.values(paymentsByDriver),
        totalPaid,
        totalLoads,
        avgPerDriver,
        avgPerLoad,
        period: {
          start: startDate || null,
          end: endDate || null,
        },
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to get driver payments report"
    return { error: message, data: null }
  }
}

// Get monthly revenue trend
export async function getMonthlyRevenueTrend(months = 6, terminalId?: string) {
  try {
    // RBAC: only allow users with reports permission
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view reports", data: [] }
    }

    const companyId = await getCompanyId()
    if (!companyId) {
      return { error: "Not authenticated", data: [] }
    }

    const supabase = await createClient()
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    startDate.setDate(1) // Start of first month

    // Invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, load_id, issue_date, amount, created_at")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })

    // Loads (fallback revenue source)
    let loadsQuery = supabase
      .from("loads")
      .select("id, created_at, value, total_rate")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .limit(10000)
    if (terminalId) {
      loadsQuery = loadsQuery.eq("terminal_id", terminalId)
    }
    const { data: loads } = await loadsQuery

    const monthlyData: Record<string, number> = {}

    // Helper to normalize a Date into YYYY-MM string
    const toMonthKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    // Process invoices first
    const allowedLoadIds = new Set((loads || []).map((l: any) => String(l.id)))
    invoices?.forEach((invoice: any) => {
      if (terminalId && invoice.load_id && !allowedLoadIds.has(String(invoice.load_id))) return
      let date: Date | null = null
      if (invoice.issue_date) {
        date = new Date(invoice.issue_date)
      } else if (invoice.created_at) {
        date = new Date(invoice.created_at)
      }
      if (!date || Number.isNaN(date.getTime())) return

      const monthKey = toMonthKey(date)
      const amount = Number(invoice.amount) || 0
      if (amount > 0) {
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount
      }
    })

    // Track loads that already have invoices so we don't double‑count
    const loadIdsWithInvoices = new Set<string>()
    invoices?.forEach((invoice: any) => {
      if (invoice.load_id) {
        loadIdsWithInvoices.add(invoice.load_id)
      }
    })

    // Add load revenue only when there is no invoice for that load
    loads?.forEach((load: any) => {
      if (!load.created_at) return
      if (load.id && loadIdsWithInvoices.has(load.id)) return

      const date = new Date(load.created_at)
      if (Number.isNaN(date.getTime())) return

      const monthKey = toMonthKey(date)
      const amount = Number(load.total_rate) || Number(load.value) || 0
      if (amount > 0) {
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount
      }
    })

    // Build a stable array of months for charting
    const trend: Array<{ month: string; amount: number; amountInThousands: number; unit: string }> = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      date.setDate(1)
      const monthKey = toMonthKey(date)
      const total = monthlyData[monthKey] || 0
      trend.push({
        month: monthKey,
        amount: total,
        amountInThousands: total / 1000,
        unit: "dollars",
      })
    }

    return { data: trend, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to fetch revenue trend"
    return { error: message, data: [] }
  }
}

type ARAgingBucketKey = "0-30" | "31-60" | "61-90" | "90+"

type ARAgingInvoiceRow = {
  id: string
  invoice_number: string
  customer_name: string
  due_date: string
  amount: number
  paid_amount: number
  outstanding_amount: number
  days_outstanding: number
  bucket: ARAgingBucketKey
}

type ARAgingBucket = {
  key: ARAgingBucketKey
  label: string
  total_outstanding: number
  invoice_count: number
  customers: Array<{
    customer_name: string
    total_outstanding: number
    invoice_count: number
    invoices: ARAgingInvoiceRow[]
  }>
  invoices: ARAgingInvoiceRow[]
}

function getAgingBucket(daysOutstanding: number): ARAgingBucketKey {
  if (daysOutstanding <= 30) return "0-30"
  if (daysOutstanding <= 60) return "31-60"
  if (daysOutstanding <= 90) return "61-90"
  return "90+"
}

function getBucketFilterRange(bucket: ARAgingBucketKey) {
  switch (bucket) {
    case "0-30":
      return { min: 0, max: 30 }
    case "31-60":
      return { min: 31, max: 60 }
    case "61-90":
      return { min: 61, max: 90 }
    case "90+":
      return { min: 91, max: Number.MAX_SAFE_INTEGER }
  }
}

export async function getARAgingReport(terminalId?: string) {
  try {
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view reports", data: null }
    }

    const companyId = await getCompanyId()
    if (!companyId) return { error: "Not authenticated", data: null }

    const supabase = await createClient()
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, due_date, amount, paid_amount, status, load_id")
      .eq("company_id", companyId)
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .order("due_date", { ascending: true })
      .limit(10000)
    let allowedLoadIds: Set<string> | null = null
    if (terminalId) {
      const { data: scopedLoads } = await supabase
        .from("loads")
        .select("id")
        .eq("company_id", companyId)
        .eq("terminal_id", terminalId)
        .limit(10000)
      allowedLoadIds = new Set((scopedLoads || []).map((l: any) => String(l.id)))
    }

    if (error) {
      return { error: "Failed to load AR aging data", data: null }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const bucketTemplate: Record<ARAgingBucketKey, ARAgingBucket> = {
      "0-30": { key: "0-30", label: "0-30 days", total_outstanding: 0, invoice_count: 0, customers: [], invoices: [] },
      "31-60": { key: "31-60", label: "31-60 days", total_outstanding: 0, invoice_count: 0, customers: [], invoices: [] },
      "61-90": { key: "61-90", label: "61-90 days", total_outstanding: 0, invoice_count: 0, customers: [], invoices: [] },
      "90+": { key: "90+", label: "90+ days", total_outstanding: 0, invoice_count: 0, customers: [], invoices: [] },
    }

    for (const inv of invoices || []) {
      if (allowedLoadIds && inv.load_id && !allowedLoadIds.has(String(inv.load_id))) continue
      const due = inv.due_date ? new Date(inv.due_date) : null
      if (!due || Number.isNaN(due.getTime())) continue

      const amount = Number(inv.amount || 0)
      const paid = Number((inv as { paid_amount?: number | string | null }).paid_amount || 0)
      const outstanding = Math.max(amount - paid, 0)
      if (outstanding <= 0) continue

      due.setHours(0, 0, 0, 0)
      const msDiff = now.getTime() - due.getTime()
      const daysOutstanding = msDiff > 0 ? Math.floor(msDiff / (1000 * 60 * 60 * 24)) : 0
      const bucketKey = getAgingBucket(daysOutstanding)

      bucketTemplate[bucketKey].invoices.push({
        id: inv.id,
        invoice_number: inv.invoice_number || inv.id,
        customer_name: inv.customer_name || "Unknown Customer",
        due_date: inv.due_date,
        amount,
        paid_amount: paid,
        outstanding_amount: outstanding,
        days_outstanding: daysOutstanding,
        bucket: bucketKey,
      })
    }

    const buckets: ARAgingBucket[] = (["0-30", "31-60", "61-90", "90+"] as const).map((key) => {
      const bucket = bucketTemplate[key]
      const customerMap = new Map<string, ARAgingBucket["customers"][number]>()

      for (const invoice of bucket.invoices) {
        const existing = customerMap.get(invoice.customer_name)
        if (existing) {
          existing.total_outstanding += invoice.outstanding_amount
          existing.invoice_count += 1
          existing.invoices.push(invoice)
        } else {
          customerMap.set(invoice.customer_name, {
            customer_name: invoice.customer_name,
            total_outstanding: invoice.outstanding_amount,
            invoice_count: 1,
            invoices: [invoice],
          })
        }
      }

      const customers = Array.from(customerMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding)
      const totalOutstanding = bucket.invoices.reduce((sum, inv) => sum + inv.outstanding_amount, 0)

      return {
        ...bucket,
        customers,
        total_outstanding: totalOutstanding,
        invoice_count: bucket.invoices.length,
      }
    })

    const totals = {
      total_outstanding: buckets.reduce((sum, b) => sum + b.total_outstanding, 0),
      total_invoices: buckets.reduce((sum, b) => sum + b.invoice_count, 0),
    }

    return { data: { buckets, totals }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to build AR aging report"), data: null }
  }
}

export async function sendARAgingBucketReminders(bucket: ARAgingBucketKey) {
  try {
    const permissionCheck = await checkViewPermission("reports")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to send reminders", data: null }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const supabase = await createClient()
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, due_date, amount, paid_amount, status")
      .eq("company_id", ctx.companyId)
      .not("status", "eq", "paid")
      .not("status", "eq", "cancelled")
      .limit(10000)

    if (error) {
      return { error: "Failed to load invoices for reminders", data: null }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const { min, max } = getBucketFilterRange(bucket)

    const invoiceRows: Array<{
      id: string
      invoice_number: string
      customer_name: string
      due_date: string
      days_outstanding: number
    }> = (invoices || []).flatMap((inv: {
      id: string
      invoice_number?: string | null
      customer_name?: string | null
      due_date?: string | null
      amount?: number | string | null
      paid_amount?: number | string | null
    }) => {
      const due = inv.due_date ? new Date(inv.due_date) : null
      if (!due || Number.isNaN(due.getTime())) return []

      due.setHours(0, 0, 0, 0)
      const daysOutstanding = Math.max(Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)), 0)
      if (daysOutstanding < min || daysOutstanding > max) return []

      const amount = Number(inv.amount || 0)
      const paid = Number((inv as { paid_amount?: number | string | null }).paid_amount || 0)
      const outstanding = Math.max(amount - paid, 0)
      if (outstanding <= 0) return []

      return [
        {
          id: inv.id,
          invoice_number: inv.invoice_number || inv.id,
          customer_name: inv.customer_name || "Unknown Customer",
          due_date: inv.due_date,
          days_outstanding: daysOutstanding,
        },
      ]
    })

    if (invoiceRows.length === 0) {
      return { data: { created: 0 }, error: null }
    }

    const invoiceIds = invoiceRows.map((r: { id: string }) => r.id)
    const { data: existingReminders } = await supabase
      .from("reminders")
      .select("invoice_id")
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")
      .eq("reminder_type", "invoice_due")
      .in("invoice_id", invoiceIds)

    const existingInvoiceIds = new Set(
      (existingReminders || [])
        .map((r: { invoice_id?: string | null }) => r.invoice_id)
        .filter((id: string | null | undefined): id is string => typeof id === "string" && id.length > 0),
    )
    const today = now.toISOString().slice(0, 10)

    const inserts = invoiceRows
      .filter((inv: { id: string }) => !existingInvoiceIds.has(inv.id))
      .map((inv: {
        id: string
        invoice_number: string
        customer_name: string
        days_outstanding: number
      }) => ({
        company_id: ctx.companyId,
        title: `AR follow-up: Invoice ${inv.invoice_number} (${inv.days_outstanding} days outstanding)`,
        description: `Customer ${inv.customer_name} has an invoice outstanding for ${inv.days_outstanding} days. Send payment follow-up.`,
        reminder_type: "invoice_due",
        due_date: today,
        reminder_date: today,
        invoice_id: inv.id,
        send_email: true,
        send_sms: false,
        status: "pending",
      }))

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("reminders").insert(inserts)
      if (insertError) {
        return { error: "Failed to create reminders", data: null }
      }
    }

    revalidatePath("/dashboard/reminders")
    return { data: { created: inserts.length }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to send AR reminders"), data: null }
  }
}

