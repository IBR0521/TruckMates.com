"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { checkCreatePermission, checkDeletePermission, checkEditPermission } from "@/lib/server-permissions"

export type TripSheetStateMileRow = { state_code: string; miles_driven: number }
export type TripSheetFuelRow = {
  state_code: string
  gallons: number
  price_per_gallon: number
  total_amount?: number | null
  city?: string | null
  location_name?: string | null
  notes?: string | null
}

export type TripSheetInput = {
  trip_date: string
  driver_id: string | null
  truck_id: string
  odometer_start?: number | null
  odometer_end?: number | null
  origin_state?: string | null
  destination_state?: string | null
  notes?: string | null
  state_miles: TripSheetStateMileRow[]
  fuel_purchases: TripSheetFuelRow[]
}

function normalizeState(code: string) {
  return code.trim().toUpperCase().slice(0, 2)
}

/**
 * Aggregates manual trip sheet miles and fuel by state for IFTA period (used by createIFTAReport).
 */
export async function getTripSheetAggregatesForIFTA(params: {
  truck_ids?: string[]
  start_date: string
  end_date: string
}): Promise<{
  data: {
    milesByState: Record<string, number>
    fuelGallonsByState: Record<string, number>
    has_data: boolean
  } | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  try {
    let q = supabase
      .from("trip_sheets")
      .select("id")
      .eq("company_id", ctx.companyId)
      .gte("trip_date", params.start_date)
      .lte("trip_date", params.end_date)

    // Match IFTA report truck filter: empty = all trucks in company for the period
    if (params.truck_ids && params.truck_ids.length > 0) {
      q = q.in("truck_id", params.truck_ids)
    }

    const { data: sheets, error: sheetErr } = await q
    if (sheetErr) {
      return { data: null, error: sheetErr.message }
    }
    if (!sheets?.length) {
      return {
        data: { milesByState: {}, fuelGallonsByState: {}, has_data: false },
        error: null,
      }
    }

    const ids = sheets.map((s: { id: string }) => s.id)

    const { data: milesRows } = await supabase
      .from("trip_sheet_state_miles")
      .select("state_code, miles_driven")
      .in("trip_sheet_id", ids)

    const { data: fuelRows } = await supabase
      .from("trip_sheet_fuel_purchases")
      .select("state_code, gallons")
      .in("trip_sheet_id", ids)

    const milesByState: Record<string, number> = {}
    milesRows?.forEach((r: { state_code: string; miles_driven: number | string }) => {
      const sc = normalizeState(r.state_code)
      const m = parseFloat(String(r.miles_driven)) || 0
      milesByState[sc] = (milesByState[sc] || 0) + m
    })

    const fuelGallonsByState: Record<string, number> = {}
    fuelRows?.forEach((r: { state_code: string; gallons: number | string }) => {
      const sc = normalizeState(r.state_code)
      const g = parseFloat(String(r.gallons)) || 0
      fuelGallonsByState[sc] = (fuelGallonsByState[sc] || 0) + g
    })

    const has_data = Object.keys(milesByState).length > 0 || Object.keys(fuelGallonsByState).length > 0
    return { data: { milesByState, fuelGallonsByState, has_data }, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || "Trip sheet aggregate failed" }
  }
}

export async function listTripSheets(filters?: { from?: string; to?: string; truck_id?: string }) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  let q = supabase
    .from("trip_sheets")
    .select(
      `
      *,
      drivers:driver_id ( id, name ),
      trucks:truck_id ( id, truck_number )
    `
    )
    .eq("company_id", ctx.companyId)
    .order("trip_date", { ascending: false })

  if (filters?.from) q = q.gte("trip_date", filters.from)
  if (filters?.to) q = q.lte("trip_date", filters.to)
  if (filters?.truck_id) q = q.eq("truck_id", filters.truck_id)

  const { data, error } = await q
  if (error) return { data: null, error: error.message }
  return { data: data || [], error: null }
}

export async function getTripSheet(id: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { data: sheet, error } = await supabase
    .from("trip_sheets")
    .select(
      `
      *,
      drivers:driver_id ( id, name ),
      trucks:truck_id ( id, truck_number )
    `
    )
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .single()

  if (error || !sheet) {
    return { data: null, error: error?.message || "Trip sheet not found" }
  }

  const { data: stateMiles } = await supabase
    .from("trip_sheet_state_miles")
    .select("*")
    .eq("trip_sheet_id", id)
    .order("state_code")

  const { data: fuel } = await supabase
    .from("trip_sheet_fuel_purchases")
    .select("*")
    .eq("trip_sheet_id", id)

  return {
    data: {
      ...sheet,
      state_miles: stateMiles || [],
      fuel_purchases: fuel || [],
    },
    error: null,
  }
}

export async function createTripSheet(input: TripSheetInput) {
  const perm = await checkCreatePermission("ifta")
  if (!perm.allowed) {
    return { data: null, error: perm.error || "No permission to create trip sheets" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { data: truckOk } = await supabase
    .from("trucks")
    .select("id")
    .eq("id", input.truck_id)
    .eq("company_id", ctx.companyId)
    .single()

  if (!truckOk) {
    return { data: null, error: "Invalid truck" }
  }

  if (input.driver_id) {
    const { data: d } = await supabase
      .from("drivers")
      .select("id")
      .eq("id", input.driver_id)
      .eq("company_id", ctx.companyId)
      .single()
    if (!d) {
      return { data: null, error: "Invalid driver" }
    }
  }

  const { data: sheet, error: insErr } = await supabase
    .from("trip_sheets")
    .insert({
      company_id: ctx.companyId,
      trip_date: input.trip_date,
      driver_id: input.driver_id || null,
      truck_id: input.truck_id,
      odometer_start: input.odometer_start ?? null,
      odometer_end: input.odometer_end ?? null,
      origin_state: input.origin_state ? normalizeState(input.origin_state) : null,
      destination_state: input.destination_state ? normalizeState(input.destination_state) : null,
      notes: input.notes || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single()

  if (insErr || !sheet) {
    return { data: null, error: insErr?.message || "Failed to create trip sheet" }
  }

  const sheetId = sheet.id

  if (input.state_miles?.length) {
    const rows = input.state_miles.map((r) => ({
      trip_sheet_id: sheetId,
      state_code: normalizeState(r.state_code),
      miles_driven: r.miles_driven,
    }))
    const { error: mErr } = await supabase.from("trip_sheet_state_miles").insert(rows)
    if (mErr) {
      await supabase.from("trip_sheets").delete().eq("id", sheetId)
      return { data: null, error: mErr.message }
    }
  }

  if (input.fuel_purchases?.length) {
    const frows = input.fuel_purchases.map((f) => {
      const total =
        f.total_amount != null
          ? f.total_amount
          : Math.round(f.gallons * f.price_per_gallon * 100) / 100
      return {
        trip_sheet_id: sheetId,
        state_code: normalizeState(f.state_code),
        gallons: f.gallons,
        price_per_gallon: f.price_per_gallon,
        total_amount: total,
        city: f.city || null,
        location_name: f.location_name || null,
        notes: f.notes || null,
      }
    })
    const { error: fErr } = await supabase.from("trip_sheet_fuel_purchases").insert(frows)
    if (fErr) {
      await supabase.from("trip_sheets").delete().eq("id", sheetId)
      return { data: null, error: fErr.message }
    }
  }

  revalidatePath("/dashboard/ifta/trip-sheet")
  return { data: { id: sheetId }, error: null }
}

export async function deleteTripSheet(id: string) {
  const perm = await checkDeletePermission("ifta")
  if (!perm.allowed) {
    return { error: perm.error || "No permission to delete" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const { error } = await supabase.from("trip_sheets").delete().eq("id", id).eq("company_id", ctx.companyId)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/ifta/trip-sheet")
  return { error: null }
}

export async function updateTripSheet(id: string, input: TripSheetInput) {
  const perm = await checkEditPermission("ifta")
  if (!perm.allowed) {
    return { data: null, error: perm.error || "No permission to update" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { error: uErr } = await supabase
    .from("trip_sheets")
    .update({
      trip_date: input.trip_date,
      driver_id: input.driver_id || null,
      truck_id: input.truck_id,
      odometer_start: input.odometer_start ?? null,
      odometer_end: input.odometer_end ?? null,
      origin_state: input.origin_state ? normalizeState(input.origin_state) : null,
      destination_state: input.destination_state ? normalizeState(input.destination_state) : null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (uErr) {
    return { data: null, error: uErr.message }
  }

  await supabase.from("trip_sheet_state_miles").delete().eq("trip_sheet_id", id)
  await supabase.from("trip_sheet_fuel_purchases").delete().eq("trip_sheet_id", id)

  if (input.state_miles?.length) {
    await supabase.from("trip_sheet_state_miles").insert(
      input.state_miles.map((r) => ({
        trip_sheet_id: id,
        state_code: normalizeState(r.state_code),
        miles_driven: r.miles_driven,
      }))
    )
  }
  if (input.fuel_purchases?.length) {
    await supabase.from("trip_sheet_fuel_purchases").insert(
      input.fuel_purchases.map((f) => ({
        trip_sheet_id: id,
        state_code: normalizeState(f.state_code),
        gallons: f.gallons,
        price_per_gallon: f.price_per_gallon,
        total_amount:
          f.total_amount != null
            ? f.total_amount
            : Math.round(f.gallons * f.price_per_gallon * 100) / 100,
        city: f.city || null,
        location_name: f.location_name || null,
        notes: f.notes || null,
      }))
    )
  }

  revalidatePath("/dashboard/ifta/trip-sheet")
  return { data: { id }, error: null }
}
