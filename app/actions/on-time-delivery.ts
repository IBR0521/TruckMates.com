"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Get on-time delivery analytics by customer
 */
export async function getOnTimeDeliveryAnalytics(filters?: {
  start_date?: string
  end_date?: string
  customer_id?: string
}) {
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
    // Get delivered loads with customer info
    let query = supabase
      .from("loads")
      .select(`
        id,
        shipment_number,
        estimated_delivery,
        actual_delivery,
        load_date,
        status,
        customer_id,
        customers:customer_id(
          id,
          name,
          company_name
        )
      `)
      .eq("company_id", company_id)
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

    const { data: loads, error } = await query

    if (error) {
      return { error: error.message || "Failed to get on-time delivery analytics", data: null }
    }

    // Aggregate by customer
    const customerMap = new Map<string, {
      customer_id: string
      customer_name: string
      total_loads: number
      on_time_loads: number
      late_loads: number
      early_loads: number
      total_days_late: number
      total_days_early: number
      average_days_difference: number
      on_time_percentage: number
    }>()

    loads?.forEach((load: any) => {
      if (!load.customer_id || !load.estimated_delivery || !load.actual_delivery) return

      const customer = load.customers
      if (!customer || !customer.id) return

      const customerId = customer.id
      const customerName = customer.name || customer.company_name || "Unknown Customer"

      const estimatedDate = new Date(load.estimated_delivery)
      const actualDate = new Date(load.actual_delivery)

      // Calculate days difference (positive = late, negative = early)
      const daysDifference = Math.round(
        (actualDate.getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24)
      )

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
    })

    // Calculate percentages and averages
    const customerResults = Array.from(customerMap.values()).map((customer) => {
      const totalDaysDifference = customer.total_days_late - customer.total_days_early
      const averageDaysDifference =
        customer.total_loads > 0 ? totalDaysDifference / customer.total_loads : 0
      const onTimePercentage =
        customer.total_loads > 0
          ? Math.round((customer.on_time_loads / customer.total_loads) * 100 * 10) / 10
          : 0

      return {
        ...customer,
        average_days_difference: Math.round(averageDaysDifference * 10) / 10,
        on_time_percentage,
        average_days_late: customer.late_loads > 0
          ? Math.round((customer.total_days_late / customer.late_loads) * 10) / 10
          : 0,
        average_days_early: customer.early_loads > 0
          ? Math.round((customer.total_days_early / customer.early_loads) * 10) / 10
          : 0,
      }
    })

    // Sort by on-time percentage (descending)
    customerResults.sort((a, b) => b.on_time_percentage - a.on_time_percentage)

    // Calculate overall summary
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
  } catch (error: any) {
    return { error: error.message || "Failed to get on-time delivery analytics", data: null }
  }
}

