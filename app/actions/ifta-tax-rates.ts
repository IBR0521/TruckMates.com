"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import type { EmployeeRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"

const MANAGER_ROLES: readonly EmployeeRole[] = ["super_admin", "operations_manager"]

/**
 * IFTA Tax Rates Management
 * Handles quarterly tax rate updates for accurate IFTA reporting
 */

export interface IFTATaxRate {
  id: string
  company_id: string
  state_code: string
  state_name: string
  quarter: number
  year: number
  tax_rate_per_gallon: number
  effective_date: string
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

/**
 * Get all tax rates for a company
 */
export async function getIFTATaxRates(filters?: {
  quarter?: number
  year?: number
  state_code?: string
}): Promise<{
  data: IFTATaxRate[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("ifta_tax_rates")
      .select(
        "id, company_id, state_code, state_name, quarter, year, tax_rate_per_gallon, effective_date, end_date, notes, created_at, updated_at, created_by",
      )
      .eq("company_id", ctx.companyId)
      .order("state_code", { ascending: true })
      .order("year", { ascending: false })
      .order("quarter", { ascending: false })

    if (filters?.quarter) {
      query = query.eq("quarter", filters.quarter)
    }

    if (filters?.year) {
      query = query.eq("year", filters.year)
    }

    if (filters?.state_code) {
      query = query.eq("state_code", filters.state_code.toUpperCase())
    }

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    return { data: data as IFTATaxRate[], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to get tax rates"), data: null }
  }
}

/**
 * Get tax rate for a specific state and quarter
 */
export async function getIFTATaxRate(
  stateCode: string,
  quarter: number,
  year: number
): Promise<{
  data: number | null // Returns the rate value
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("get_ifta_tax_rate", {
      p_company_id: ctx.companyId,
      p_state_code: stateCode.toUpperCase(),
      p_quarter: quarter,
      p_year: year,
    })

    if (error) {
      Sentry.captureException(error)
      // FIXED: Distinguish 'rate not found' (use default, no error) from 'DB error' (return error)
      // For real database failures, return error so callers can alert the user
      return { data: null, error: `Database error: ${error.message}. Tax rates could not be verified.` }
    }

    // If data is null/undefined, rate not found - use default (no error)
    if (data === null || data === undefined) {
      return { data: 0.25, error: null } // Default 25 cents per gallon
    }

    return { data: data || 0.25, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    // FIXED: Return error for real exceptions, not silent default
    return { data: null, error: `Failed to get tax rate: ${errorMessage(error)}` }
  }
}

/**
 * Get all tax rates for a quarter (for report generation)
 */
export async function getIFTATaxRatesForQuarter(
  quarter: number,
  year: number
): Promise<{
  data: Record<string, number> | null // state_code -> rate mapping
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("get_ifta_tax_rates_for_quarter", {
      p_company_id: ctx.companyId,
      p_quarter: quarter,
      p_year: year,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    // Convert array to state_code -> rate mapping
    const ratesMap: Record<string, number> = {}
    if (data) {
      data.forEach((rate: any) => {
        ratesMap[rate.state_code] = parseFloat(rate.tax_rate_per_gallon)
      })
    }

    return { data: ratesMap, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to get tax rates"), data: null }
  }
}

/**
 * Create or update tax rate
 */
export async function upsertIFTATaxRate(formData: {
  state_code: string
  state_name: string
  quarter: number
  year: number
  tax_rate_per_gallon: number
  effective_date: string
  end_date?: string | null
  notes?: string | null
}): Promise<{
  data: IFTATaxRate | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update tax rates", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("ifta_tax_rates")
      .upsert(
        {
          company_id: ctx.companyId,
          state_code: formData.state_code.toUpperCase(),
          state_name: formData.state_name,
          quarter: formData.quarter,
          year: formData.year,
          tax_rate_per_gallon: formData.tax_rate_per_gallon,
          effective_date: formData.effective_date,
          end_date: formData.end_date || null,
          notes: formData.notes || null,
          created_by: ctx.userId ?? undefined,
        },
        {
          onConflict: "company_id,state_code,quarter,year",
        }
      )
      .select()
      .single()

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/accounting/ifta/tax-rates")
    return { data: data as IFTATaxRate, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update tax rate"), data: null }
  }
}

/**
 * Bulk update tax rates for a quarter
 */
export async function bulkUpdateIFTATaxRates(
  quarter: number,
  year: number,
  rates: Array<{
    state_code: string
    state_name: string
    tax_rate_per_gallon: number
  }>
): Promise<{
  data: { updated: number } | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update tax rates", data: null }
  }

  try {
    // Calculate effective date based on quarter
    const quarterStartMonths = [1, 4, 7, 10]
    const startMonth = quarterStartMonths[quarter - 1]
    const effectiveDate = `${year}-${String(startMonth).padStart(2, "0")}-01`

    // Prepare bulk insert data
    const ratesToInsert = rates.map((rate) => ({
      company_id: ctx.companyId,
      state_code: rate.state_code.toUpperCase(),
      state_name: rate.state_name,
      quarter,
      year,
      tax_rate_per_gallon: rate.tax_rate_per_gallon,
      effective_date: effectiveDate,
      created_by: ctx.userId ?? null,
    }))

    const { error } = await supabase.from("ifta_tax_rates").upsert(ratesToInsert, {
      onConflict: "company_id,state_code,quarter,year",
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/accounting/ifta/tax-rates")
    return { data: { updated: rates.length }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to bulk update tax rates"), data: null }
  }
}

/**
 * Delete tax rate
 */
export async function deleteIFTATaxRate(id: string): Promise<{
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can delete tax rates" }
  }

  try {
    const { error } = await supabase
      .from("ifta_tax_rates")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (error) {
      Sentry.captureException(error)
      return { error: error.message }
    }

    revalidatePath("/dashboard/accounting/ifta/tax-rates")
    return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete tax rate") }
  }
}

