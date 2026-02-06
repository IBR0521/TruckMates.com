"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    let query = supabase
      .from("ifta_tax_rates")
      .select("*")
      .eq("company_id", result.company_id)
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
      console.error("Error fetching IFTA tax rates:", error)
      return { error: error.message, data: null }
    }

    return { data: data as IFTATaxRate[], error: null }
  } catch (error: any) {
    console.error("Unhandled error in getIFTATaxRates:", error)
    return { error: error.message || "Failed to get tax rates", data: null }
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("get_ifta_tax_rate", {
      p_company_id: result.company_id,
      p_state_code: stateCode.toUpperCase(),
      p_quarter: quarter,
      p_year: year,
    })

    if (error) {
      console.error("Error fetching IFTA tax rate:", error)
      // Return default rate if not found (fallback)
      return { data: 0.25, error: null } // Default 25 cents per gallon
    }

    return { data: data || 0.25, error: null }
  } catch (error: any) {
    console.error("Unhandled error in getIFTATaxRate:", error)
    return { data: 0.25, error: null } // Default fallback
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("get_ifta_tax_rates_for_quarter", {
      p_company_id: result.company_id,
      p_quarter: quarter,
      p_year: year,
    })

    if (error) {
      console.error("Error fetching IFTA tax rates for quarter:", error)
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
  } catch (error: any) {
    console.error("Unhandled error in getIFTATaxRatesForQuarter:", error)
    return { error: error.message || "Failed to get tax rates", data: null }
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Check if user is manager
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "manager") {
    return { error: "Only managers can update tax rates", data: null }
  }

  try {
    const { data, error } = await supabase
      .from("ifta_tax_rates")
      .upsert(
        {
          company_id: result.company_id,
          state_code: formData.state_code.toUpperCase(),
          state_name: formData.state_name,
          quarter: formData.quarter,
          year: formData.year,
          tax_rate_per_gallon: formData.tax_rate_per_gallon,
          effective_date: formData.effective_date,
          end_date: formData.end_date || null,
          notes: formData.notes || null,
          created_by: user.id,
        },
        {
          onConflict: "company_id,state_code,quarter,year",
        }
      )
      .select()
      .single()

    if (error) {
      console.error("Error upserting IFTA tax rate:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/accounting/ifta/tax-rates")
    return { data: data as IFTATaxRate, error: null }
  } catch (error: any) {
    console.error("Unhandled error in upsertIFTATaxRate:", error)
    return { error: error.message || "Failed to update tax rate", data: null }
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Check if user is manager
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "manager") {
    return { error: "Only managers can update tax rates", data: null }
  }

  try {
    // Calculate effective date based on quarter
    const quarterStartMonths = [1, 4, 7, 10]
    const startMonth = quarterStartMonths[quarter - 1]
    const effectiveDate = `${year}-${String(startMonth).padStart(2, "0")}-01`

    // Prepare bulk insert data
    const ratesToInsert = rates.map((rate) => ({
      company_id: result.company_id,
      state_code: rate.state_code.toUpperCase(),
      state_name: rate.state_name,
      quarter,
      year,
      tax_rate_per_gallon: rate.tax_rate_per_gallon,
      effective_date: effectiveDate,
      created_by: user.id,
    }))

    const { error } = await supabase.from("ifta_tax_rates").upsert(ratesToInsert, {
      onConflict: "company_id,state_code,quarter,year",
    })

    if (error) {
      console.error("Error bulk updating IFTA tax rates:", error)
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/accounting/ifta/tax-rates")
    return { data: { updated: rates.length }, error: null }
  } catch (error: any) {
    console.error("Unhandled error in bulkUpdateIFTATaxRates:", error)
    return { error: error.message || "Failed to bulk update tax rates", data: null }
  }
}

/**
 * Delete tax rate
 */
export async function deleteIFTATaxRate(id: string): Promise<{
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found" }
  }

  // Check if user is manager
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "manager") {
    return { error: "Only managers can delete tax rates" }
  }

  try {
    const { error } = await supabase
      .from("ifta_tax_rates")
      .delete()
      .eq("id", id)
      .eq("company_id", result.company_id)

    if (error) {
      console.error("Error deleting IFTA tax rate:", error)
      return { error: error.message }
    }

    revalidatePath("/dashboard/accounting/ifta/tax-rates")
    return { error: null }
  } catch (error: any) {
    console.error("Unhandled error in deleteIFTATaxRate:", error)
    return { error: error.message || "Failed to delete tax rate" }
  }
}

