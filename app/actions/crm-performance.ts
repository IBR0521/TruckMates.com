"use server"

/**
 * CRM Performance Metrics Actions
 * Provides real-time performance data for customers and vendors
 */

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getCurrentCompanyFeatureAccess } from "@/lib/plan-gates"

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

export interface CRMRevenueSnapshot {
  this_month_revenue: number
  outstanding_invoices: number
}

async function ensureCrmAccess() {
  const access = await getCurrentCompanyFeatureAccess("crm")
  if (access.error) {
    return { allowed: false, error: access.error }
  }
  if (!access.allowed) {
    return { allowed: false, error: "CRM is available on Fleet and Enterprise plans" }
  }
  return { allowed: true as const, error: null as string | null }
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
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // SECURITY FIX: Use explicit column selection instead of select("*")
    let query = supabase
      .from("crm_customer_performance")
      .select(`
        company_id,
        customer_id,
        name,
        company_name,
        relationship_type,
        status,
        payment_terms,
        total_loads,
        completed_loads,
        on_time_deliveries,
        on_time_rate,
        total_revenue,
        pending_revenue,
        paid_invoices,
        pending_invoices,
        avg_payment_days,
        last_load_date,
        last_invoice_date,
        revenue_per_load
      `)
      .eq("company_id", ctx.companyId)

    // Apply filters
    if (filters?.relationship_type) {
      query = query.eq("relationship_type", filters.relationship_type)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // MEDIUM FIX: Add limit to prevent unbounded aggregation queries
    const { data, error } = await query.order("total_revenue", { ascending: false }).limit(1000)

    if (error) {
      // If view doesn't exist, return empty data instead of error
      if (error.message?.includes("does not exist") || error.code === "42P01" || error.message?.includes("schema cache")) {
        Sentry.captureMessage(
          "[CRM Performance] View crm_customer_performance does not exist. Please run the SQL migration.",
          "warning",
        )
        return { data: [], error: null }
      }
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
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get performance metrics for a specific customer
 */
export async function getCustomerPerformance(customerId: string): Promise<{
  data: CustomerPerformanceMetrics | null
  error: string | null
}> {
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // SECURITY FIX: Use explicit column selection instead of select("*")
    const { data, error } = await supabase
      .from("crm_customer_performance")
      .select(`
        company_id,
        customer_id,
        name,
        company_name,
        relationship_type,
        status,
        payment_terms,
        total_loads,
        completed_loads,
        on_time_deliveries,
        on_time_rate,
        total_revenue,
        pending_revenue,
        paid_invoices,
        pending_invoices,
        avg_payment_days,
        last_load_date,
        last_invoice_date,
        revenue_per_load
      `)
      .eq("customer_id", customerId)
      .eq("company_id", ctx.companyId)
      .single()

    if (error) {
      // If view doesn't exist, return null data instead of error
      if (error.message?.includes("does not exist") || error.code === "42P01" || error.message?.includes("schema cache")) {
        Sentry.captureMessage(
          "[CRM Performance] View crm_customer_performance does not exist. Please run the SQL migration.",
          "warning",
        )
        return { data: null, error: null }
      }
      return { error: error.message, data: null }
    }

    return { data: data as CustomerPerformanceMetrics, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get customer performance"), data: null }
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
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // SECURITY FIX: Use explicit column selection instead of select("*")
    // Query vendor performance directly with company_id filter (if view supports it)
    // Otherwise, filter by vendor IDs from the company
    let query = supabase
      .from("crm_vendor_performance")
      .select(`
        company_id,
        vendor_id,
        name,
        company_name,
        relationship_type,
        status,
        total_expenses,
        total_spent,
        avg_expense_amount,
        last_transaction_date,
        first_transaction_date,
        transactions_per_month
      `)
      .eq("company_id", ctx.companyId)

    // Apply filters
    if (filters?.relationship_type) {
      query = query.eq("relationship_type", filters.relationship_type)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    // MEDIUM FIX: Add limit to prevent unbounded aggregation queries
    const { data, error } = await query.order("total_spent", { ascending: false }).limit(1000)

    if (error) {
      // CRITICAL FIX: Handle schema cache errors gracefully - view might not exist
      if (error.message?.includes("schema cache") || error.message?.includes("does not exist") || error.code === "42P01") {
        Sentry.captureMessage(
          "[CRM Performance] View crm_vendor_performance does not exist. Please run the SQL migration.",
          "warning",
        )
        return { data: [], error: null }
      }
      return { error: error.message, data: null }
    }

    // Apply client-side filters
    let filteredData = data || []

    if (filters?.min_transactions) {
      filteredData = filteredData.filter((d: any) => d.total_expenses >= filters.min_transactions!)
    }

    return { data: filteredData as VendorPerformanceMetrics[], error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get vendor performance metrics"), data: null }
  }
}

/**
 * Get performance metrics for a specific vendor
 */
export async function getVendorPerformance(vendorId: string): Promise<{
  data: VendorPerformanceMetrics | null
  error: string | null
}> {
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // SECURITY FIX: Use explicit column selection instead of select("*")
    const { data, error } = await supabase
      .from("crm_vendor_performance")
      .select(`
        company_id,
        vendor_id,
        name,
        company_name,
        relationship_type,
        status,
        total_expenses,
        total_spent,
        avg_expense_amount,
        last_transaction_date,
        first_transaction_date,
        transactions_per_month
      `)
      .eq("vendor_id", vendorId)
      .eq("company_id", ctx.companyId)
      .single()

    if (error) {
      // CRITICAL FIX: Handle schema cache errors gracefully - view might not exist
      if (error.message?.includes("schema cache") || error.message?.includes("does not exist") || error.code === "42P01") {
        Sentry.captureMessage(
          "[CRM Performance] View crm_vendor_performance does not exist. Please run the SQL migration.",
          "warning",
        )
        return { data: null, error: null }
      }
      return { error: error.message, data: null }
    }

    return { data: data as VendorPerformanceMetrics, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get vendor performance"), data: null }
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
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // SECURITY FIX: Use explicit column selection instead of select("*")
    // Get all customer metrics directly from the view to avoid circular dependency
    let customerQuery = supabase
      .from("crm_customer_performance")
      .select(`
        company_id,
        customer_id,
        name,
        company_name,
        relationship_type,
        status,
        payment_terms,
        total_loads,
        completed_loads,
        on_time_deliveries,
        on_time_rate,
        total_revenue,
        pending_revenue,
        paid_invoices,
        pending_invoices,
        avg_payment_days,
        last_load_date,
        last_invoice_date,
        revenue_per_load
      `)
      .eq("company_id", ctx.companyId)
    
    // MEDIUM FIX: Add limit to prevent unbounded aggregation queries
    const { data: customersData, error: customersError } = await customerQuery.order("total_revenue", { ascending: false }).limit(1000)
    
    if (customersError) {
      // If view doesn't exist, return empty data instead of error
      if (customersError.message?.includes("does not exist") || customersError.code === "42P01" || customersError.message?.includes("schema cache")) {
        Sentry.captureMessage(
          "[CRM Performance] View crm_customer_performance does not exist. Please run the SQL migration.",
          "warning",
        )
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

    // SECURITY FIX: Use explicit column selection instead of select("*")
    // Get all vendor metrics directly from the view with company_id filter
    // MEDIUM FIX: Add limit to prevent unbounded aggregation queries
    const { data: vendorsData2, error: vendorsError2 } = await supabase
      .from("crm_vendor_performance")
      .select(`
        company_id,
        vendor_id,
        name,
        company_name,
        relationship_type,
        status,
        total_expenses,
        total_spent,
        avg_expense_amount,
        last_transaction_date,
        first_transaction_date,
        transactions_per_month
      `)
      .eq("company_id", ctx.companyId)
      .order("total_spent", { ascending: false })
      .limit(1000)

    if (vendorsError2) {
      // CRITICAL FIX: Handle schema cache errors gracefully - view might not exist
      if (vendorsError2.message?.includes("schema cache") || vendorsError2.message?.includes("does not exist") || vendorsError2.code === "42P01") {
        Sentry.captureMessage(
          "[CRM Performance] View crm_vendor_performance does not exist. Please run the SQL migration.",
          "warning",
        )
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
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get relationship insights"), data: null }
  }
}

/**
 * Revenue snapshot for CRM dashboard
 */
export async function getCRMRevenueSnapshot(): Promise<{ data: CRMRevenueSnapshot | null; error: string | null }> {
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

    const { data: monthInvoices, error: monthError } = await supabase
      .from("invoices")
      .select("amount, issue_date")
      .eq("company_id", ctx.companyId)
      .gte("issue_date", startOfMonth)
      .lte("issue_date", endOfMonth)
      .limit(5000)

    if (monthError) {
      return { error: monthError.message, data: null }
    }

    const { data: outstandingInvoices, error: outstandingError } = await supabase
      .from("invoices")
      .select("amount, status")
      .eq("company_id", ctx.companyId)
      .in("status", ["pending", "sent", "overdue", "partial", "partially_paid"])
      .limit(5000)

    if (outstandingError) {
      return { error: outstandingError.message, data: null }
    }

    const this_month_revenue =
      (monthInvoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0)
    const outstanding_invoices =
      (outstandingInvoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0)

    return {
      data: {
        this_month_revenue,
        outstanding_invoices,
      },
      error: null,
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to load CRM revenue snapshot"), data: null }
  }
}

/**
 * Customers with no recent loads (default 30 days)
 */
export async function getInactiveCustomers(days = 30): Promise<{
  data: Array<{
    customer_id: string
    name: string
    company_name: string | null
    last_load_date: string | null
    days_inactive: number
    total_revenue: number
    total_loads: number
  }> | null
  error: string | null
}> {
  const access = await ensureCrmAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { data, error } = await supabase
      .from("crm_customer_performance")
      .select("customer_id, name, company_name, last_load_date, total_revenue, total_loads, status")
      .eq("company_id", ctx.companyId)
      .eq("status", "active")
      .order("last_load_date", { ascending: true, nullsFirst: true })
      .limit(1000)

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01" || error.message?.includes("schema cache")) {
        return { data: [], error: null }
      }
      return { error: error.message, data: null }
    }

    const now = new Date().getTime()
    const inactive = (data || [])
      .filter((c: any) => !c.last_load_date || new Date(c.last_load_date).getTime() < cutoff.getTime())
      .map((c: any) => {
        const lastLoadMs = c.last_load_date ? new Date(c.last_load_date).getTime() : 0
        const days_inactive = c.last_load_date ? Math.floor((now - lastLoadMs) / (1000 * 60 * 60 * 24)) : days
        return {
          customer_id: c.customer_id,
          name: c.name,
          company_name: c.company_name,
          last_load_date: c.last_load_date,
          days_inactive,
          total_revenue: Number(c.total_revenue || 0),
          total_loads: Number(c.total_loads || 0),
        }
      })
      .sort((a: { days_inactive: number }, b: { days_inactive: number }) => b.days_inactive - a.days_inactive)

    return { data: inactive, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to load inactive customers"), data: null }
  }
}

