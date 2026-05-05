"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { getELDMileageData } from "./eld"
import { checkCreatePermission, checkDeletePermission } from "@/lib/server-permissions"
import { STATE_FUEL_TAX_RATES, getFuelTaxRate } from "@/lib/fuel-tax-rates"
import * as Sentry from "@sentry/nextjs"
import { capturePostHogServerEvent } from "@/lib/analytics/posthog-server"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


const IFTA_REPORT_SELECT =
  "id, company_id, quarter, year, period, total_miles, fuel_purchased, tax_owed, status, filed_date, state_breakdown, truck_ids, include_eld, created_at, updated_at"

export async function getIFTAReports() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data: reports, error } = await supabase
      .from("ifta_reports")
      .select(IFTA_REPORT_SELECT)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: reports, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function deleteIFTAReport(id: string) {
  // BUG-015 FIX: Move permission check before any database queries
  const permissionCheck = await checkDeletePermission("ifta")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete IFTA reports" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const { error } = await supabase
    .from("ifta_reports")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: safeDbError(error) }
  }

  revalidatePath("/dashboard/ifta")
  return { error: null }
}

export async function createIFTAReport(formData: {
  quarter: string
  year: number
  truck_ids: string[]
  include_eld: boolean
  period_start?: string
  period_end?: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // RBAC check
  const permissionCheck = await checkCreatePermission("ifta")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create IFTA reports", data: null }
  }

  // Validate all truck_ids belong to company
  if (formData.truck_ids && formData.truck_ids.length > 0) {
    const { data: ownedTrucks, error: trucksError } = await supabase
      .from("trucks")
      .select("id")
      .eq("company_id", ctx.companyId)
      .in("id", formData.truck_ids)

    if (trucksError) {
      return { error: "Failed to validate trucks", data: null }
    }

    const validTruckIds = ownedTrucks?.map((t: { id: string; [key: string]: any }) => t.id) || []
    if (validTruckIds.length !== formData.truck_ids.length) {
      return { error: "One or more trucks do not belong to your company", data: null }
    }
  }

  // FIXED: Validate quarter value before proceeding
  const year = formData.year
  const quarter = formData.quarter
  let periodStart = ""
  let periodEnd = ""
  let period = ""

  if (quarter === "Q1") {
    periodStart = `${year}-01-01`
    periodEnd = `${year}-03-31`
    period = `Jan-Mar ${year}`
  } else if (quarter === "Q2") {
    periodStart = `${year}-04-01`
    periodEnd = `${year}-06-30`
    period = `Apr-Jun ${year}`
  } else if (quarter === "Q3") {
    periodStart = `${year}-07-01`
    periodEnd = `${year}-09-30`
    period = `Jul-Sep ${year}`
  } else if (quarter === "Q4") {
    periodStart = `${year}-10-01`
    periodEnd = `${year}-12-31`
    period = `Oct-Dec ${year}`
  } else {
    // Invalid quarter value - return error
    return { error: "Invalid quarter value. Must be Q1, Q2, Q3, or Q4.", data: null }
  }

  // Validate dates are set
  if (!periodStart || !periodEnd) {
    return { error: "Failed to calculate period dates. Please check quarter and year values.", data: null }
  }

  // Override with custom dates if provided
  if (formData.period_start) periodStart = formData.period_start
  if (formData.period_end) periodEnd = formData.period_end

  // State mileage: GPS/ELD state crossings + manual IFTA trip sheets (no ELD required)
  const { getStateMileageBreakdown } = await import("./ifta-state-crossing")
  const { getTripSheetAggregatesForIFTA } = await import("./ifta-trip-sheet")
  const validTruckIds = formData.truck_ids && formData.truck_ids.length > 0 ? formData.truck_ids : undefined
  const stateMileageResult = await getStateMileageBreakdown({
    truck_ids: validTruckIds,
    start_date: periodStart,
    end_date: periodEnd,
  })

  const tripSheetAgg = await getTripSheetAggregatesForIFTA({
    truck_ids: validTruckIds,
    start_date: periodStart,
    end_date: periodEnd,
  })
  if (tripSheetAgg.error) {
    Sentry.captureMessage(
      `[IFTA] Trip sheet aggregates skipped: ${tripSheetAgg.error} (Run supabase/trip_sheets_schema.sql if manual trip sheets are required.)`,
      "warning",
    )
  }
  const tripMilesByState = tripSheetAgg.data?.milesByState || {}
  const tripFuelByState = tripSheetAgg.data?.fuelGallonsByState || {}
  const hasTripSheets = tripSheetAgg.data?.has_data === true

  const gpsRows = stateMileageResult.data || []
  const hasGpsCrossings = gpsRows.length > 0

  let stateBreakdown: Array<{
    state: string
    miles: number
    fuel: string | number
    tax: string | number
    fuelFormatted?: string
    taxFormatted?: string
    taxRate?: number
    state_code?: string
    mileage_source?: "gps" | "trip_sheet" | "both"
  }> = []
  let totalMiles = 0
  let iftaDataSources: Record<string, unknown> | null = null

  // GPS crossings and/or manual trip sheets → combined state-by-state miles
  if (hasGpsCrossings || hasTripSheets) {
    const { getIFTATaxRatesForQuarter } = await import("./ifta-tax-rates")
    const quarterNumber = quarter === "Q1" ? 1 : quarter === "Q2" ? 2 : quarter === "Q3" ? 3 : 4
    const taxRatesResult = await getIFTATaxRatesForQuarter(quarterNumber, year)
    const taxRates: Record<string, number> = taxRatesResult.data || STATE_FUEL_TAX_RATES

    const { data: fuelPurchases } = await supabase
      .from("fuel_purchases")
      .select("state, gallons")
      .eq("company_id", ctx.companyId)
      .gte("purchase_date", periodStart)
      .lte("purchase_date", periodEnd)

    const fuelByState: Record<string, number> = {}
    fuelPurchases?.forEach((purchase: { state: string; gallons: number | string | null }) => {
      const st = purchase.state
      if (!fuelByState[st]) fuelByState[st] = 0
      fuelByState[st] += parseFloat(purchase.gallons?.toString() || "0")
    })
    for (const [st, gal] of Object.entries(tripFuelByState)) {
      if (!fuelByState[st]) fuelByState[st] = 0
      fuelByState[st] += gal
    }

    const gpsByCode = new Map<string, { miles: number; state_name: string }>()
    for (const stateData of gpsRows) {
      const code = String(stateData.state_code || "").toUpperCase().slice(0, 2)
      if (!code) continue
      gpsByCode.set(code, {
        miles: parseFloat(stateData.total_miles?.toString() || "0"),
        state_name: stateData.state_name || code,
      })
    }

    const allCodes = new Set<string>([...gpsByCode.keys(), ...Object.keys(tripMilesByState)])
    const perStateSources: Record<string, "gps" | "trip_sheet" | "both"> = {}

    for (const stateCode of allCodes) {
      const gpsM = gpsByCode.get(stateCode)?.miles ?? 0
      const sheetM = tripMilesByState[stateCode] ?? 0
      const miles = gpsM + sheetM
      if (miles <= 0) continue

      let mileage_source: "gps" | "trip_sheet" | "both"
      if (gpsM > 0 && sheetM > 0) mileage_source = "both"
      else if (gpsM > 0) mileage_source = "gps"
      else mileage_source = "trip_sheet"
      perStateSources[stateCode] = mileage_source

      totalMiles += miles
      const stateName = gpsByCode.get(stateCode)?.state_name || stateCode
      const taxRate = taxRates[stateCode] || getFuelTaxRate(stateCode, 0.25)
      const fuelGallons =
        fuelByState[stateCode] !== undefined ? fuelByState[stateCode] : Math.round(miles / 6.5)
      const taxDue = (miles / 6.5) * taxRate

      stateBreakdown.push({
        state: stateName,
        state_code: stateCode,
        miles: Math.round(miles),
        mileage_source,
        fuel: fuelGallons,
        fuelFormatted: `${fuelGallons.toLocaleString()} gal`,
        tax: taxDue,
        taxFormatted: `$${taxDue.toFixed(2)}`,
        taxRate,
      })
    }

    stateBreakdown.sort((a, b) => String(a.state_code || a.state).localeCompare(String(b.state_code || b.state)))

    iftaDataSources = {
      uses_gps: hasGpsCrossings,
      uses_trip_sheets: hasTripSheets,
      per_state_sources: perStateSources,
      summary:
        hasGpsCrossings && hasTripSheets
          ? "Combined GPS/ELD state crossings and manual IFTA trip sheets."
          : hasGpsCrossings
            ? "Miles from GPS/ELD state crossings."
            : "Miles from manual IFTA trip sheets (no ELD required).",
    }
  } else {
    // Fallback: Use ELD data or routes if no state crossing data available
    if (formData.include_eld && formData.truck_ids.length > 0) {
      // Use ELD mileage data if available
      const eldResult = await getELDMileageData({
        truck_ids: formData.truck_ids,
        start_date: periodStart,
        end_date: periodEnd,
      })

      if (eldResult.data && eldResult.data.totalMiles > 0) {
        totalMiles = eldResult.data.totalMiles
      }
    }

    // FIXED: Use route_start_time or route_departure_time instead of created_at for trip date filtering
    // created_at is when the route was created in the system, not when the trip occurred
    if (totalMiles === 0 && validTruckIds && validTruckIds.length > 0) {
      // Try to get routes by trip date (route_start_time or route_departure_time)
      let routesQuery = supabase
        .from("routes")
        .select("distance, truck_id, route_start_time, route_departure_time, created_at")
        .eq("company_id", ctx.companyId)
        .in("truck_id", validTruckIds)
      
      // Filter by trip date if available, otherwise fall back to created_at
      // First try route_start_time, then route_departure_time, then created_at
      let routes: any[] = []
      
      // Try route_start_time first
      const { data: routesByStartTime } = await routesQuery
        .gte("route_start_time", periodStart)
        .lte("route_start_time", periodEnd)
      
      if (routesByStartTime && routesByStartTime.length > 0) {
        routes = routesByStartTime
      } else {
        // Try route_departure_time
        const { data: routesByDeparture } = await supabase
          .from("routes")
          .select("distance, truck_id, route_start_time, route_departure_time, created_at")
          .eq("company_id", ctx.companyId)
          .in("truck_id", validTruckIds)
          .gte("route_departure_time", periodStart)
          .lte("route_departure_time", periodEnd)
        
        if (routesByDeparture && routesByDeparture.length > 0) {
          routes = routesByDeparture
        } else {
          // Fallback to created_at (but log warning)
          const { data: fallbackRoutes } = await supabase
            .from("routes")
            .select("distance, truck_id")
            .eq("company_id", ctx.companyId)
            .in("truck_id", validTruckIds)
            .gte("created_at", periodStart)
            .lte("created_at", periodEnd)
          
          if (fallbackRoutes && fallbackRoutes.length > 0) {
            Sentry.captureMessage(
              "[IFTA] Using created_at for route filtering - trip dates (route_start_time/route_departure_time) not available",
              "warning",
            )
          }
          
          routes = fallbackRoutes || []
        }
      }

      routes?.forEach((route) => {
        const distance = route.distance || "0 mi"
        const miles = parseInt(distance.replace(/[^0-9]/g, "")) || 0
        totalMiles += miles
      })
    }

    // If we still don't have mileage data, return error instead of fabricating data
    if (totalMiles === 0) {
      return {
        error:
          "Cannot generate IFTA report: No mileage data for the selected period. Add GPS/ELD state crossings, or enter manual IFTA trip sheets (Dashboard → IFTA → Trip sheet).",
        data: null,
      }
    }

    // No state-level breakdown: only aggregate miles from ELD/routes — cannot file IFTA without states
    return {
      error: `Cannot generate IFTA report: State-by-state mileage breakdown is required for IFTA filing.

No GPS state crossings or trip sheet entries found for ${periodStart} to ${periodEnd}.

Options:
• Use ELD/mobile GPS so state crossings are recorded automatically, or
• Enter trip sheets at /dashboard/ifta/trip-sheet (manual miles and fuel by state).`,
      data: null,
    }
  }

  // FIXED: Calculate totals from raw numeric values (not formatted strings)
  // Keep running numeric totals throughout to avoid round-trip string parsing precision loss
  const totalFuel = stateBreakdown.reduce(
    (sum, state) => {
      // Use numeric fuel value if available, otherwise parse from formatted string
      return sum + (typeof state.fuel === 'number' ? state.fuel : parseFloat((state.fuel || "0").toString().replace(/[^0-9.]/g, "")))
    },
    0
  )
  const totalTax = stateBreakdown.reduce(
    (sum, state) => {
      // Use numeric tax value if available, otherwise parse from formatted string
      return sum + (typeof state.tax === 'number' ? state.tax : parseFloat((state.tax || "0").toString().replace(/[^0-9.]/g, "")))
    },
    0
  )

  const insertPayload: Record<string, unknown> = {
    company_id: ctx.companyId,
    quarter: formData.quarter,
    year: formData.year,
    period: period,
    total_miles: totalMiles,
    total_miles_formatted: `${totalMiles.toLocaleString()} mi`,
    fuel_purchased: Math.round(totalFuel),
    fuel_purchased_formatted: `${Math.round(totalFuel).toLocaleString()} gal`,
    tax_owed: totalTax,
    status: "draft",
    truck_ids: formData.truck_ids,
    include_eld: formData.include_eld,
    state_breakdown: stateBreakdown,
  }
  if (iftaDataSources) {
    insertPayload.ifta_data_sources = iftaDataSources
  }

  const { data, error } = await supabase.from("ifta_reports").insert(insertPayload).select().single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  await capturePostHogServerEvent(ctx.userId || `company:${ctx.companyId}`, "ifta_report_generated", {
    company_id: ctx.companyId,
    user_id: ctx.userId || null,
    ifta_report_id: data?.id || null,
    quarter: formData.quarter,
    year: formData.year,
  })

  revalidatePath("/dashboard/ifta")
  return { data, error: null }
}

