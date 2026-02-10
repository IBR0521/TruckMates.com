"use server"

import { createClient } from "@/lib/supabase/server"

// Helper to get company ID
async function getCompanyId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  return userData?.company_id || null
}

// Revenue Report
export async function getRevenueReport(startDate?: string, endDate?: string) {
  const companyId = await getCompanyId()
  if (!companyId) return { error: "Not authenticated", data: null }

  const supabase = await createClient()
  
  // Get ALL invoices (not just paid) - use created_at for reliable date filtering
  let invoiceQuery = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)

  if (startDate) {
    invoiceQuery = invoiceQuery.gte("created_at", startDate)
  }
  if (endDate) {
    invoiceQuery = invoiceQuery.lte("created_at", endDate + "T23:59:59")
  }

  const { data: invoices, error: invoiceError } = await invoiceQuery.order("created_at", { ascending: false })

  // Also get loads data as fallback/supplement
  let loadQuery = supabase
    .from("loads")
    .select("id, shipment_number, customer_id, total_rate, value, created_at")
    .eq("company_id", companyId)

  if (startDate) {
    loadQuery = loadQuery.gte("created_at", startDate)
  }
  if (endDate) {
    loadQuery = loadQuery.lte("created_at", endDate + "T23:59:59")
  }

  const { data: loads } = await loadQuery.order("created_at", { ascending: false })

  // Get customers for loads
  const customerIds = loads?.map(l => l.customer_id).filter(Boolean) || []
  let customers = null
  if (customerIds.length > 0) {
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", customerIds)
    customers = data
  }

  const customerMap = new Map<string, string>()
  customers?.forEach(c => customerMap.set(c.id, c.name))

  // Calculate revenue by customer
  const revenueByCustomer: Record<
    string,
    { customer: string; loads: number; revenue: number; avgPerLoad: number }
  > = {}

  // Process invoices
  invoices?.forEach((invoice) => {
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
  })

  // Process loads (add to revenue if no invoice exists for that load)
  if (loads) {
    loads.forEach((load: any) => {
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
}

// Profit & Loss Report
export async function getProfitLossReport(startDate?: string, endDate?: string) {
  const companyId = await getCompanyId()
  if (!companyId) return { error: "Not authenticated", data: null }

  const supabase = await createClient()

  // Get ALL invoices (not just paid) - use created_at for reliable date filtering
  let revenueQuery = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)

  if (startDate) {
    revenueQuery = revenueQuery.gte("created_at", startDate)
  }
  if (endDate) {
    revenueQuery = revenueQuery.lte("created_at", endDate + "T23:59:59")
  }

  const { data: invoices } = await revenueQuery

  // Also get revenue from loads
  let loadQuery = supabase
    .from("loads")
    .select("total_rate, value, created_at")
    .eq("company_id", companyId)

  if (startDate) {
    loadQuery = loadQuery.gte("created_at", startDate)
  }
  if (endDate) {
    loadQuery = loadQuery.lte("created_at", endDate + "T23:59:59")
  }

  const { data: loads } = await loadQuery

  // Get expenses
  let expensesQuery = supabase
    .from("expenses")
    .select("*")
    .eq("company_id", companyId)

  if (startDate) {
    expensesQuery = expensesQuery.gte("date", startDate)
  }
  if (endDate) {
    expensesQuery = expensesQuery.lte("date", endDate)
  }

  const { data: expenses } = await expensesQuery

  // Calculate totals - combine invoices and loads
  let totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0
  
  // Add revenue from loads
  if (loads) {
    const loadRevenue = loads.reduce((sum, load) => {
      return sum + (Number(load.total_rate) || Number(load.value) || 0)
    }, 0)
    totalRevenue += loadRevenue
  }
  
  const totalExpenses = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0
  const netProfit = totalRevenue - totalExpenses

  // Revenue breakdown
  const revenueBreakdown: Record<string, number> = {}
  
  // Process invoices
  invoices?.forEach((invoice) => {
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
  
  // Process loads
  if (loads) {
    const loadRevenue = loads.reduce((sum, load) => {
      return sum + (Number(load.total_rate) || Number(load.value) || 0)
    }, 0)
    if (loadRevenue > 0) {
      revenueBreakdown["Load Revenue"] = (revenueBreakdown["Load Revenue"] || 0) + loadRevenue
    }
  }

  // Expense breakdown by category
  const expenseBreakdown: Record<string, number> = {}
  expenses?.forEach((expense) => {
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
}

// Driver Payments Report
export async function getDriverPaymentsReport(startDate?: string, endDate?: string) {
  const companyId = await getCompanyId()
  if (!companyId) return { error: "Not authenticated", data: null }

  const supabase = await createClient()

  // Get settlements
  let settlementsQuery = supabase
    .from("settlements")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "paid")

  if (startDate) {
    settlementsQuery = settlementsQuery.gte("period_start", startDate)
  }
  if (endDate) {
    settlementsQuery = settlementsQuery.lte("period_end", endDate)
  }

  const { data: settlements, error } = await settlementsQuery.order("period_end", { ascending: false })

  if (error) return { error: error.message, data: null }

  // Get driver details
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("company_id", companyId)

  // Create driver lookup map
  const driverMap = new Map<string, string>()
  drivers?.forEach((driver) => {
    driverMap.set(driver.id, driver.name)
  })

  // Get all settlements for YTD calculation
  const currentYear = new Date().getFullYear()
  const { data: allYearSettlements } = await supabase
    .from("settlements")
    .select("driver_id, net_pay")
    .eq("company_id", companyId)
    .eq("status", "paid")
    .gte("period_start", `${currentYear}-01-01`)
    .lte("period_end", `${currentYear}-12-31`)

  // Calculate YTD by driver
  const ytdByDriver: Record<string, number> = {}
  allYearSettlements?.forEach((settlement) => {
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

  settlements?.forEach((settlement) => {
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

  const totalPaid = settlements?.reduce((sum, s) => sum + (Number(s.net_pay) || 0), 0) || 0
  const totalLoads = settlements?.reduce((sum, s) => {
    const loads = Array.isArray(s.loads) ? s.loads.length : 0
    return sum + loads
  }, 0) || 0
  const avgPerDriver = Object.keys(paymentsByDriver).length > 0 ? totalPaid / Object.keys(paymentsByDriver).length : 0
  const avgPerLoad = totalLoads > 0 ? totalPaid / totalLoads : 0

  return {
    data: {
      settlements,
      paymentsByDriver: Object.values(paymentsByDriver),
      totalPaid,
      totalLoads,
      avgPerDriver,
      avgPerLoad,
    },
    error: null,
  }
}

// Get monthly revenue trend
export async function getMonthlyRevenueTrend(months: number = 6) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return { error: "Not authenticated", data: [] }
    }

    const supabase = await createClient()
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    startDate.setDate(1) // Start of first month

    // Get ALL invoices for revenue calculation (including pending/overdue)
    // Also try to get revenue from loads if invoices don't have data
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("issue_date, amount, status, created_at")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })

    // Also get revenue from loads (value field) as fallback
    const { data: loads } = await supabase
      .from("loads")
      .select("created_at, value, total_rate")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())

    // Group by month - combine invoices and loads
    const monthlyData: Record<string, number> = {}
    
    // Process invoices (use issue_date if available, otherwise created_at)
    if (invoices) {
      invoices.forEach((invoice) => {
        let date: Date | null = null
        if (invoice.issue_date) {
          date = new Date(invoice.issue_date)
        } else if (invoice.created_at) {
          date = new Date(invoice.created_at)
        }
        
        if (!date || isNaN(date.getTime())) return
        
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const amount = Number(invoice.amount) || 0
        if (amount > 0) {
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount
        }
      })
    }

    // Process loads - combine with invoice data (don't double count if invoice exists for load)
    if (loads) {
      loads.forEach((load) => {
        if (!load.created_at) return
        const date = new Date(load.created_at)
        if (isNaN(date.getTime())) return
        
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        // Only add load revenue if there's no invoice for this load (to avoid double counting)
        // For now, we'll include it but prioritize invoices
        const amount = Number(load.total_rate) || Number(load.value) || 0
        if (amount > 0) {
          // Add load revenue (invoices take priority, but loads supplement)
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (amount * 0.5) // Weight loads less to avoid double counting
        }
      })
    }

    // Generate all months in range (even if no data) for consistent chart display
    const trend: Array<{ month: string; amount: number }> = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      date.setDate(1) // First day of month
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      trend.push({
        month: monthKey,
        amount: (monthlyData[monthKey] || 0) / 1000, // Convert to thousands
      })
    }

    return { data: trend, error: null }
  } catch (error: any) {
    console.error("Error in getMonthlyRevenueTrend:", error)
    return { error: error?.message || "Failed to fetch revenue trend", data: [] }
  }
}

