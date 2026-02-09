"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

// US State fuel tax rates (per gallon) - These are approximate and should be updated regularly
const STATE_FUEL_TAX_RATES: Record<string, number> = {
  AL: 0.24, AK: 0.0895, AZ: 0.19, AR: 0.2475, CA: 0.51,
  CO: 0.22, CT: 0.35, DE: 0.23, FL: 0.33, GA: 0.2875,
  HI: 0.16, ID: 0.33, IL: 0.39, IN: 0.33, IA: 0.305,
  KS: 0.24, KY: 0.26, LA: 0.20, ME: 0.30, MD: 0.33,
  MA: 0.24, MI: 0.27, MN: 0.285, MS: 0.18, MO: 0.17,
  MT: 0.32, NE: 0.29, NV: 0.23, NH: 0.23, NJ: 0.105,
  NM: 0.17, NY: 0.33, NC: 0.36, ND: 0.23, OH: 0.385,
  OK: 0.20, OR: 0.38, PA: 0.58, RI: 0.34, SC: 0.24,
  SD: 0.28, TN: 0.26, TX: 0.20, UT: 0.305, VT: 0.31,
  VA: 0.26, WA: 0.494, WV: 0.35, WI: 0.309, WY: 0.24,
  DC: 0.235
}

// Get fuel purchases
export async function getFuelPurchases(filters?: {
  startDate?: string
  endDate?: string
  state?: string
  truckId?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  let query = supabase
    .from("fuel_purchases")
    .select("*, trucks:truck_id(id, truck_number), drivers:driver_id(id, name)", { count: "exact" })
    .eq("company_id", result.company_id)
    .order("purchase_date", { ascending: false })

  if (filters?.startDate) {
    query = query.gte("purchase_date", filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte("purchase_date", filters.endDate)
  }
  if (filters?.state) {
    query = query.eq("state", filters.state)
  }
  if (filters?.truckId) {
    query = query.eq("truck_id", filters.truckId)
  }

  const limit = Math.min(filters?.limit || 50, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: data || [], error: null, count: count || 0 }
}

// Create fuel purchase
export async function createFuelPurchase(formData: {
  truck_id?: string
  driver_id?: string
  purchase_date: string
  state: string
  city?: string
  station_name?: string
  gallons: number
  price_per_gallon: number
  odometer_reading?: number
  receipt_number?: string
  receipt_url?: string
  notes?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Validate required fields
  if (!formData.purchase_date || !formData.state || !formData.gallons || !formData.price_per_gallon) {
    return { error: "Purchase date, state, gallons, and price per gallon are required", data: null }
  }

  const totalCost = formData.gallons * formData.price_per_gallon

  const { data, error } = await supabase
    .from("fuel_purchases")
    .insert({
      company_id: result.company_id,
      truck_id: formData.truck_id || null,
      driver_id: formData.driver_id || null,
      purchase_date: formData.purchase_date,
      state: formData.state.toUpperCase(),
      city: formData.city || null,
      station_name: formData.station_name || null,
      gallons: formData.gallons,
      price_per_gallon: formData.price_per_gallon,
      total_cost: totalCost,
      odometer_reading: formData.odometer_reading || null,
      receipt_number: formData.receipt_number || null,
      receipt_url: formData.receipt_url || null,
      notes: formData.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/tax-fuel")
  return { data, error: null }
}

// Update fuel purchase
export async function updateFuelPurchase(
  id: string,
  formData: {
    truck_id?: string
    driver_id?: string
    purchase_date?: string
    state?: string
    city?: string
    station_name?: string
    gallons?: number
    price_per_gallon?: number
    odometer_reading?: number
    receipt_number?: string
    receipt_url?: string
    notes?: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id
  if (formData.driver_id !== undefined) updateData.driver_id = formData.driver_id
  if (formData.purchase_date) updateData.purchase_date = formData.purchase_date
  if (formData.state) updateData.state = formData.state.toUpperCase()
  if (formData.city !== undefined) updateData.city = formData.city
  if (formData.station_name !== undefined) updateData.station_name = formData.station_name
  if (formData.gallons !== undefined) updateData.gallons = formData.gallons
  if (formData.price_per_gallon !== undefined) updateData.price_per_gallon = formData.price_per_gallon
  if (formData.odometer_reading !== undefined) updateData.odometer_reading = formData.odometer_reading
  if (formData.receipt_number !== undefined) updateData.receipt_number = formData.receipt_number
  if (formData.receipt_url !== undefined) updateData.receipt_url = formData.receipt_url
  if (formData.notes !== undefined) updateData.notes = formData.notes

  // Recalculate total cost if gallons or price changed
  if (formData.gallons !== undefined || formData.price_per_gallon !== undefined) {
    const { data: existing } = await supabase
      .from("fuel_purchases")
      .select("gallons, price_per_gallon")
      .eq("id", id)
      .single()

    if (existing) {
      const gallons = formData.gallons !== undefined ? formData.gallons : existing.gallons
      const price = formData.price_per_gallon !== undefined ? formData.price_per_gallon : existing.price_per_gallon
      updateData.total_cost = gallons * price
    }
  }

  const { data, error } = await supabase
    .from("fuel_purchases")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/tax-fuel")
  return { data, error: null }
}

// Delete fuel purchase
export async function deleteFuelPurchase(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  const { error } = await supabase
    .from("fuel_purchases")
    .delete()
    .eq("id", id)
    .eq("company_id", result.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/tax-fuel")
  return { data: { success: true }, error: null }
}

// Get IFTA reports
export async function getIFTAReports(filters?: {
  quarter?: number
  year?: number
  status?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  let query = supabase
    .from("ifta_reports")
    .select("*")
    .eq("company_id", result.company_id)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false })

  if (filters?.quarter) {
    query = query.eq("quarter", filters.quarter)
  }
  if (filters?.year) {
    query = query.eq("year", filters.year)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: data || [], error: null }
}

// Get IFTA report with state breakdown
export async function getIFTAReport(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get report
  const { data: report, error: reportError } = await supabase
    .from("ifta_reports")
    .select("*")
    .eq("id", id)
    .eq("company_id", result.company_id)
    .single()

  if (reportError || !report) {
    return { error: reportError?.message || "Report not found", data: null }
  }

  // Get state breakdown
  const { data: breakdown, error: breakdownError } = await supabase
    .from("ifta_state_breakdown")
    .select("*")
    .eq("ifta_report_id", id)
    .order("state", { ascending: true })

  if (breakdownError) {
    return { error: breakdownError.message, data: null }
  }

  return {
    data: {
      ...report,
      state_breakdown: breakdown || [],
    },
    error: null,
  }
}

// Generate IFTA report for a quarter
export async function generateIFTAReport(quarter: number, year: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Validate quarter
  if (quarter < 1 || quarter > 4) {
    return { error: "Quarter must be between 1 and 4", data: null }
  }

  // Check if report already exists
  const { data: existing } = await supabase
    .from("ifta_reports")
    .select("id")
    .eq("company_id", result.company_id)
    .eq("quarter", quarter)
    .eq("year", year)
    .single()

  if (existing) {
    return { error: "IFTA report for this quarter already exists", data: null }
  }

  // Calculate quarter date range
  const quarterStartMonths = [1, 4, 7, 10]
  const quarterEndMonths = [3, 6, 9, 12]
  const startMonth = quarterStartMonths[quarter - 1]
  const endMonth = quarterEndMonths[quarter - 1]
  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`
  const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${new Date(year, endMonth, 0).getDate()}`

  // Get fuel purchases for the quarter
  const { data: fuelPurchases } = await supabase
    .from("fuel_purchases")
    .select("*")
    .eq("company_id", result.company_id)
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)

  // Get routes/miles for the quarter (this would need to be calculated from route data)
  // For now, we'll use a placeholder - in production, this would aggregate from routes table
  const { data: routes } = await supabase
    .from("routes")
    .select("distance, origin, destination")
    .eq("company_id", result.company_id)
    .gte("created_at", startDate)
    .lte("created_at", endDate)

  // Calculate state-by-state breakdown
  const stateData: Record<string, { gallons: number; miles: number }> = {}

  // Aggregate fuel purchases by state
  fuelPurchases?.forEach((purchase) => {
    const state = purchase.state
    if (!stateData[state]) {
      stateData[state] = { gallons: 0, miles: 0 }
    }
    stateData[state].gallons += parseFloat(purchase.gallons.toString())
  })

  // Aggregate miles by state (simplified - in production, use actual route tracking)
  // For now, estimate miles based on fuel purchases (assuming 6.5 MPG)
  Object.keys(stateData).forEach((state) => {
    stateData[state].miles = stateData[state].gallons * 6.5
  })

  // Calculate totals
  const totalGallons = Object.values(stateData).reduce((sum, data) => sum + data.gallons, 0)
  const totalMiles = Object.values(stateData).reduce((sum, data) => sum + data.miles, 0)

  // Calculate tax due and paid by state
  let totalTaxDue = 0
  let totalTaxPaid = 0

  const stateBreakdowns = Object.entries(stateData).map(([state, data]) => {
    const taxRate = STATE_FUEL_TAX_RATES[state] || 0.25 // Default rate if state not found
    const taxDue = data.miles * (taxRate / 100) // Simplified calculation
    const taxPaid = data.gallons * taxRate // Tax paid at purchase
    const netTaxDue = taxDue - taxPaid

    totalTaxDue += taxDue
    totalTaxPaid += taxPaid

    return {
      state,
      miles: data.miles,
      gallons: data.gallons,
      tax_rate: taxRate,
      tax_due: taxDue,
      tax_paid: taxPaid,
      net_tax_due: netTaxDue,
    }
  })

  const netTaxDue = totalTaxDue - totalTaxPaid

  // Create IFTA report
  const { data: report, error: reportError } = await supabase
    .from("ifta_reports")
    .insert({
      company_id: result.company_id,
      quarter,
      year,
      total_miles: totalMiles,
      total_gallons: totalGallons,
      total_tax_due: totalTaxDue,
      total_tax_paid: totalTaxPaid,
      net_tax_due: netTaxDue,
      status: "draft",
    })
    .select()
    .single()

  if (reportError) {
    return { error: reportError.message, data: null }
  }

  // Create state breakdowns
  if (stateBreakdowns.length > 0) {
    const { error: breakdownError } = await supabase.from("ifta_state_breakdown").insert(
      stateBreakdowns.map((breakdown) => ({
        ifta_report_id: report.id,
        state: breakdown.state,
        miles: breakdown.miles,
        gallons: breakdown.gallons,
        tax_rate: breakdown.tax_rate,
        tax_due: breakdown.tax_due,
        tax_paid: breakdown.tax_paid,
        net_tax_due: breakdown.net_tax_due,
      }))
    )

    if (breakdownError) {
      console.error("Failed to create state breakdowns:", breakdownError)
    }
  }

  revalidatePath("/dashboard/accounting/tax-fuel")
  return { data: report, error: null }
}

// Update IFTA report status
export async function updateIFTAReportStatus(
  id: string,
  status: "draft" | "submitted" | "approved" | "rejected",
  notes?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === "submitted") {
    updateData.submitted_at = new Date().toISOString()
  } else if (status === "approved") {
    updateData.approved_at = new Date().toISOString()
  }

  if (notes) {
    updateData.notes = notes
  }

  const { data, error } = await supabase
    .from("ifta_reports")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/tax-fuel")
  return { data, error: null }
}

// Delete IFTA report
export async function deleteIFTAReport(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  const { error } = await supabase
    .from("ifta_reports")
    .delete()
    .eq("id", id)
    .eq("company_id", result.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/tax-fuel")
  return { data: { success: true }, error: null }
}





