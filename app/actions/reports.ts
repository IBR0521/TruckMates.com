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
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "paid")

  if (startDate) {
    query = query.gte("issue_date", startDate)
  }
  if (endDate) {
    query = query.lte("issue_date", endDate)
  }

  const { data: invoices, error } = await query.order("issue_date", { ascending: false })

  if (error) return { error: error.message, data: null }

  // Note: Revenue is primarily from invoices, loads are tracked separately

  // Calculate revenue by customer
  const revenueByCustomer: Record<
    string,
    { customer: string; loads: number; revenue: number; avgPerLoad: number }
  > = {}

  invoices?.forEach((invoice) => {
    const customer = invoice.customer_name
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

  // Calculate averages
  Object.values(revenueByCustomer).forEach((item) => {
    item.avgPerLoad = item.loads > 0 ? item.revenue / item.loads : 0
  })

  const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0
  const totalLoads = invoices?.length || 0
  const avgPerLoad = totalLoads > 0 ? totalRevenue / totalLoads : 0

  return {
    data: {
      invoices,
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

  // Get revenue (paid invoices)
  let revenueQuery = supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "paid")

  if (startDate) {
    revenueQuery = revenueQuery.gte("issue_date", startDate)
  }
  if (endDate) {
    revenueQuery = revenueQuery.lte("issue_date", endDate)
  }

  const { data: invoices } = await revenueQuery

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

  // Calculate totals
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0
  const totalExpenses = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0
  const netProfit = totalRevenue - totalExpenses

  // Revenue breakdown
  const revenueBreakdown: Record<string, number> = {}
  invoices?.forEach((invoice) => {
    const items = (invoice.items as any[]) || []
    items.forEach((item: any) => {
      const category = item.category || "Load Revenue"
      revenueBreakdown[category] = (revenueBreakdown[category] || 0) + (Number(item.amount) || 0)
    })
    // If no items, count as load revenue
    if (items.length === 0) {
      revenueBreakdown["Load Revenue"] = (revenueBreakdown["Load Revenue"] || 0) + (Number(invoice.amount) || 0)
    }
  })

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
  const companyId = await getCompanyId()
  if (!companyId) return { error: "Not authenticated", data: null }

  const supabase = await createClient()
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  const { data: invoices } = await supabase
    .from("invoices")
    .select("issue_date, amount")
    .eq("company_id", companyId)
    .eq("status", "paid")
    .gte("issue_date", startDate.toISOString().split("T")[0])
    .lte("issue_date", endDate.toISOString().split("T")[0])

  // Group by month
  const monthlyData: Record<string, number> = {}
  invoices?.forEach((invoice) => {
    const date = new Date(invoice.issue_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (Number(invoice.amount) || 0)
  })

  // Convert to array format
  const trend = Object.entries(monthlyData)
    .map(([month, amount]) => ({
      month,
      amount: amount / 1000, // Convert to thousands
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return { data: trend, error: null }
}

