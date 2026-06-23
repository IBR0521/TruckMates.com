import type { SupabaseClient } from "@supabase/supabase-js"

export type CustomerOtdMetrics = {
  customer_id: string
  customer_name: string
  total_loads: number
  on_time_loads: number
  late_loads: number
  early_loads: number
  average_days_difference: number
  on_time_percentage: number
  average_days_late: number
  average_days_early: number
}

export type OnTimeDeliveryAnalyticsResult = {
  summary: {
    total_loads: number
    on_time_loads: number
    late_loads: number
    early_loads: number
    on_time_percentage: number
  }
  customers: CustomerOtdMetrics[]
}

type LoadRow = {
  customer_id: string | null
  estimated_delivery: string | null
  actual_delivery: string | null
  customers?: { id?: string | null; name?: string | null; company_name?: string | null } | null
}

/**
 * Core on-time delivery aggregation (shared by reports UI and proactive detection).
 */
export async function computeOnTimeDeliveryByCustomer(
  supabase: SupabaseClient,
  companyId: string,
  filters?: {
    start_date?: string
    end_date?: string
    customer_id?: string
  },
): Promise<{ data: OnTimeDeliveryAnalyticsResult | null; error: string | null }> {
  let query = supabase
    .from("loads")
    .select(`
      id,
      customer_id,
      estimated_delivery,
      actual_delivery,
      customers:customer_id(
        id,
        name,
        company_name
      )
    `)
    .eq("company_id", companyId)
    .eq("status", "delivered")
    .not("estimated_delivery", "is", null)
    .not("actual_delivery", "is", null)

  if (filters?.customer_id) {
    query = query.eq("customer_id", filters.customer_id)
  }
  if (filters?.start_date) {
    query = query.gte("actual_delivery", filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte("actual_delivery", filters.end_date)
  }

  query = query.limit(10000)

  const { data: loads, error } = await query
  if (error) {
    return { data: null, error: error.message || "Failed to load delivery data" }
  }

  const customerMap = new Map<string, CustomerOtdMetrics & { total_days_late: number; total_days_early: number }>()

  for (const load of (loads || []) as LoadRow[]) {
    if (!load.customer_id || !load.estimated_delivery || !load.actual_delivery) continue

    const customer = load.customers
    if (!customer?.id) continue

    const customerId = customer.id
    const customerName = customer.name || customer.company_name || "Unknown Customer"

    const estimatedDate = new Date(load.estimated_delivery)
    const actualDate = new Date(load.actual_delivery)
    const estimatedDay = new Date(estimatedDate.getFullYear(), estimatedDate.getMonth(), estimatedDate.getDate())
    const actualDay = new Date(actualDate.getFullYear(), actualDate.getMonth(), actualDate.getDate())
    const daysDifference = Math.round((actualDay.getTime() - estimatedDay.getTime()) / (1000 * 60 * 60 * 24))

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customer_id: customerId,
        customer_name: customerName,
        total_loads: 0,
        on_time_loads: 0,
        late_loads: 0,
        early_loads: 0,
        total_days_late: 0,
        total_days_early: 0,
        average_days_difference: 0,
        on_time_percentage: 0,
        average_days_late: 0,
        average_days_early: 0,
      })
    }

    const customerData = customerMap.get(customerId)!
    customerData.total_loads += 1

    if (daysDifference === 0) {
      customerData.on_time_loads += 1
    } else if (daysDifference > 0) {
      customerData.late_loads += 1
      customerData.total_days_late += daysDifference
    } else {
      customerData.early_loads += 1
      customerData.total_days_early += Math.abs(daysDifference)
    }
  }

  const customerResults: CustomerOtdMetrics[] = Array.from(customerMap.values()).map((customer) => {
    const totalDaysDifference = customer.total_days_late - customer.total_days_early
    const averageDaysDifference =
      customer.total_loads > 0 ? totalDaysDifference / customer.total_loads : 0
    const onTimePercentage =
      customer.total_loads > 0
        ? Math.round((customer.on_time_loads / customer.total_loads) * 100 * 10) / 10
        : 0

    return {
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      total_loads: customer.total_loads,
      on_time_loads: customer.on_time_loads,
      late_loads: customer.late_loads,
      early_loads: customer.early_loads,
      average_days_difference: Math.round(averageDaysDifference * 10) / 10,
      on_time_percentage: onTimePercentage,
      average_days_late:
        customer.late_loads > 0
          ? Math.round((customer.total_days_late / customer.late_loads) * 10) / 10
          : 0,
      average_days_early:
        customer.early_loads > 0
          ? Math.round((customer.total_days_early / customer.early_loads) * 10) / 10
          : 0,
    }
  })

  customerResults.sort((a, b) => b.on_time_percentage - a.on_time_percentage)

  const totalLoads = customerResults.reduce((sum, c) => sum + c.total_loads, 0)
  const totalOnTime = customerResults.reduce((sum, c) => sum + c.on_time_loads, 0)
  const totalLate = customerResults.reduce((sum, c) => sum + c.late_loads, 0)
  const totalEarly = customerResults.reduce((sum, c) => sum + c.early_loads, 0)
  const overallOnTimePercentage =
    totalLoads > 0 ? Math.round((totalOnTime / totalLoads) * 100 * 10) / 10 : 0

  return {
    data: {
      summary: {
        total_loads: totalLoads,
        on_time_loads: totalOnTime,
        late_loads: totalLate,
        early_loads: totalEarly,
        on_time_percentage: overallOnTimePercentage,
      },
      customers: customerResults,
    },
    error: null,
  }
}
