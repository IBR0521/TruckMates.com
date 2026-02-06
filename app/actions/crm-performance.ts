"use server"

/**
 * CRM Performance Metrics Actions
 * Provides real-time performance data for customers and vendors
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface CustomerPerformanceMetrics {
  customer_id: string
  name: string
  company_name: string | null
  relationship_type: string | null
  status: string
  payment_terms: string | null
  total_loads: number
  completed_loads: number
  on_time_deliveries: number
  on_time_rate: number
  total_revenue: number
  pending_revenue: number
  paid_invoices: number
  pending_invoices: number
  avg_payment_days: number | null
  last_load_date: string | null
  last_invoice_date: string | null
  revenue_per_load: number
}

export interface VendorPerformanceMetrics {
  vendor_id: string
  name: string
  company_name: string | null
  relationship_type: string | null
  status: string
  total_expenses: number
  total_spent: number
  avg_expense_amount: number | null
  last_transaction_date: string | null
  first_transaction_date: string | null
  transactions_per_month: number
}

/**
 * Get performance metrics for all customers
 */
export async function getCustomerPerformanceMetrics(filters?: {
  relationship_type?: string
  status?: string
  min_loads?: number
  min_revenue?: number
}): Promise<{ data: CustomerPerformanceMetrics[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let query = supabase
      .from("crm_customer_performance")
      .select("*")
      .eq("company_id", company_id)

    // Apply filters
    if (filters?.relationship_type) {
      query = query.eq("relationship_type", filters.relationship_type)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    const { data, error } = await query.order("total_revenue", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    // Apply client-side filters that can't be done in SQL view
    let filteredData = data || []

    if (filters?.min_loads) {
      filteredData = filteredData.filter((d: any) => d.total_loads >= filters.min_loads!)
    }
    if (filters?.min_revenue) {
      filteredData = filteredData.filter((d: any) => d.total_revenue >= filters.min_revenue!)
    }

    return { data: filteredData as CustomerPerformanceMetrics[], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get customer performance metrics", data: null }
  }
}

/**
 * Get performance metrics for a specific customer
 */
export async function getCustomerPerformance(customerId: string): Promise<{
  data: CustomerPerformanceMetrics | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("crm_customer_performance")
      .select("*")
      .eq("customer_id", customerId)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data as CustomerPerformanceMetrics, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get customer performance", data: null }
  }
}

/**
 * Get performance metrics for all vendors
 */
export async function getVendorPerformanceMetrics(filters?: {
  relationship_type?: string
  status?: string
  min_transactions?: number
}): Promise<{ data: VendorPerformanceMetrics[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get vendors with their company_id
    const { data: vendors, error: vendorsError } = await supabase
      .from("vendors")
      .select("id, company_id")
      .eq("company_id", company_id)

    if (vendorsError) {
      return { error: vendorsError.message, data: null }
    }

    if (!vendors || vendors.length === 0) {
      return { data: [], error: null }
    }

    const vendorIds = vendors.map((v) => v.id)

    let query = supabase
      .from("crm_vendor_performance")
      .select("*")
      .in("vendor_id", vendorIds)

    // Apply filters
    if (filters?.relationship_type) {
      query = query.eq("relationship_type", filters.relationship_type)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    const { data, error } = await query.order("total_spent", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    // Apply client-side filters
    let filteredData = data || []

    if (filters?.min_transactions) {
      filteredData = filteredData.filter((d: any) => d.total_expenses >= filters.min_transactions!)
    }

    return { data: filteredData as VendorPerformanceMetrics[], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get vendor performance metrics", data: null }
  }
}

/**
 * Get performance metrics for a specific vendor
 */
export async function getVendorPerformance(vendorId: string): Promise<{
  data: VendorPerformanceMetrics | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("crm_vendor_performance")
      .select("*")
      .eq("vendor_id", vendorId)
      .single()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data as VendorPerformanceMetrics, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get vendor performance", data: null }
  }
}

/**
 * Get relationship insights (top performers, at-risk relationships, etc.)
 */
export async function getRelationshipInsights(): Promise<{
  data: {
    top_customers: CustomerPerformanceMetrics[]
    top_vendors: VendorPerformanceMetrics[]
    slow_payers: CustomerPerformanceMetrics[]
    low_performers: CustomerPerformanceMetrics[]
  } | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get all customer metrics directly from the view to avoid circular dependency
    let customerQuery = supabase
      .from("crm_customer_performance")
      .select("*")
      .eq("company_id", company_id)
    
    const { data: customersData, error: customersError } = await customerQuery.order("total_revenue", { ascending: false })
    
    if (customersError) {
      // If view doesn't exist, return empty data instead of error
      if (customersError.message?.includes("does not exist") || customersError.code === "42P01") {
        console.warn("[CRM Performance] View crm_customer_performance does not exist. Please run the SQL migration.")
        return {
          data: {
            top_customers: [],
            top_vendors: [],
            slow_payers: [],
            low_performers: [],
          },
          error: null,
        }
      }
      return { error: customersError.message || "Failed to get customer metrics", data: null }
    }

    const customers = (customersData || []) as CustomerPerformanceMetrics[]

    // Get all vendor metrics directly from the view
    const { data: vendorsData, error: vendorsError } = await supabase
      .from("vendors")
      .select("id, company_id")
      .eq("company_id", company_id)

    if (vendorsError) {
      return { error: vendorsError.message || "Failed to get vendor metrics", data: null }
    }

    if (!vendorsData || vendorsData.length === 0) {
      return {
        data: {
          top_customers: [],
          top_vendors: [],
          slow_payers: [],
          low_performers: [],
        },
        error: null,
      }
    }

    const vendorIds = vendorsData.map((v) => v.id)
    const { data: vendorsData2, error: vendorsError2 } = await supabase
      .from("crm_vendor_performance")
      .select("*")
      .in("vendor_id", vendorIds)
      .order("total_spent", { ascending: false })

    if (vendorsError2) {
      // If view doesn't exist, return empty data instead of error
      if (vendorsError2.message?.includes("does not exist") || vendorsError2.code === "42P01") {
        console.warn("[CRM Performance] View crm_vendor_performance does not exist. Please run the SQL migration.")
        return {
          data: {
            top_customers: customers.filter((c) => c.total_revenue > 0)
              .sort((a, b) => b.total_revenue - a.total_revenue)
              .slice(0, 10),
            top_vendors: [],
            slow_payers: customers
              .filter((c) => c.avg_payment_days !== null && c.avg_payment_days > 45)
              .sort((a, b) => (b.avg_payment_days || 0) - (a.avg_payment_days || 0)),
            low_performers: customers
              .filter((c) => c.on_time_rate < 85 && c.total_loads > 5)
              .sort((a, b) => a.on_time_rate - b.on_time_rate),
          },
          error: null,
        }
      }
      return { error: vendorsError2.message || "Failed to get vendor metrics", data: null }
    }

    const vendors = (vendorsData2 || []) as VendorPerformanceMetrics[]

    // Top customers (by revenue)
    const top_customers = customers
      .filter((c) => c.total_revenue > 0)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)

    // Top vendors (by spending)
    const top_vendors = vendors
      .filter((v) => v.total_spent > 0)
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 10)

    // Slow payers (avg payment days > 45)
    const slow_payers = customers
      .filter((c) => c.avg_payment_days !== null && c.avg_payment_days > 45)
      .sort((a, b) => (b.avg_payment_days || 0) - (a.avg_payment_days || 0))

    // Low performers (on-time rate < 85% and total_loads > 5)
    const low_performers = customers
      .filter((c) => c.on_time_rate < 85 && c.total_loads > 5)
      .sort((a, b) => a.on_time_rate - b.on_time_rate)

    return {
      data: {
        top_customers,
        top_vendors,
        slow_payers,
        low_performers,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get relationship insights", data: null }
  }
}

