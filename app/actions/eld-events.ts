"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"

export type HarshEvent = {
  id: string
  company_id: string
  truck_id: string | null
  driver_id: string | null
  eld_device_id: string
  event_type: string
  severity: string
  occurred_at: string
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  speed_mph: number | null
  speed_limit_mph: number | null
  g_force: number | null
  duration_seconds: number | null
  provider: string
  provider_event_id: string
  raw_payload: Record<string, unknown>
  reviewed: boolean
  reviewed_at: string | null
  coaching_note: string | null
  driver?: { id: string; name: string | null } | null
  truck?: { id: string; truck_number: string | null } | null
}

export type IdleSession = {
  id: string
  company_id: string
  truck_id: string | null
  driver_id: string | null
  eld_device_id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  estimated_fuel_gallons: number | null
  estimated_fuel_cost_usd: number | null
  provider: string
  provider_session_id: string
  raw_payload: Record<string, unknown>
  truck?: { id: string; truck_number: string | null } | null
  driver?: { id: string; name: string | null } | null
}

async function requireCompanyAndHarshGate(): Promise<{ companyId: string } | { error: string }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: "eld_harsh_events" })
  if (!gate.allowed) {
    return { error: "Harsh event history is available on Professional and Fleet plans." }
  }
  return { companyId: ctx.companyId }
}

async function requireCompanyAndIdleGate(): Promise<{ companyId: string } | { error: string }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: "eld_idle_tracking" })
  if (!gate.allowed) {
    return { error: "Idle time analytics are available on Professional and Fleet plans." }
  }
  return { companyId: ctx.companyId }
}

export async function getHarshEventsForCompany(params: {
  daysBack?: number
  driverId?: string
  truckId?: string
  eventTypes?: string[]
  severities?: string[]
  limit?: number
}): Promise<{ data: HarshEvent[] | null; error: string | null }> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const days = Math.min(Math.max(1, params.daysBack ?? 7), 365)
  const limit = Math.min(Math.max(1, params.limit ?? 100), 500)
  const from = new Date()
  from.setDate(from.getDate() - days)

  let q = supabase
    .from("eld_harsh_events")
    .select(
      `id, company_id, truck_id, driver_id, eld_device_id, event_type, severity, occurred_at,
       location_lat, location_lng, location_address, speed_mph, speed_limit_mph, g_force,
       duration_seconds, provider, provider_event_id, raw_payload, reviewed, reviewed_at, coaching_note,
       driver:drivers(id, name),
       truck:trucks(id, truck_number)`,
    )
    .eq("company_id", gate.companyId)
    .gte("occurred_at", from.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (params.driverId) q = q.eq("driver_id", params.driverId)
  if (params.truckId) q = q.eq("truck_id", params.truckId)
  if (params.eventTypes && params.eventTypes.length > 0) q = q.in("event_type", params.eventTypes)
  if (params.severities && params.severities.length > 0) q = q.in("severity", params.severities)

  const { data, error } = await q
  if (error) return { data: null, error: safeDbError(error) }
  const rows = (data || []) as unknown[]
  return {
    data: rows.map((r) => {
      const o = r as Record<string, unknown>
      return {
        ...o,
        raw_payload: (typeof o.raw_payload === "object" && o.raw_payload && !Array.isArray(o.raw_payload)
          ? (o.raw_payload as Record<string, unknown>)
          : {}) as Record<string, unknown>,
      } as HarshEvent
    }),
    error: null,
  }
}

export async function getIdleSessionsForCompany(params: {
  daysBack?: number
  driverId?: string
  truckId?: string
  minDurationMinutes?: number
}): Promise<{ data: IdleSession[] | null; error: string | null }> {
  const gate = await requireCompanyAndIdleGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const days = Math.min(Math.max(1, params.daysBack ?? 7), 365)
  const from = new Date()
  from.setDate(from.getDate() - days)
  const minSec =
    params.minDurationMinutes != null ? Math.max(0, Math.round(params.minDurationMinutes * 60)) : 0

  let q = supabase
    .from("eld_idle_sessions")
    .select(
      `id, company_id, truck_id, driver_id, eld_device_id, started_at, ended_at, duration_seconds,
       location_lat, location_lng, location_address, estimated_fuel_gallons, estimated_fuel_cost_usd,
       provider, provider_session_id, raw_payload,
       truck:trucks(id, truck_number),
       driver:drivers(id, name)`,
    )
    .eq("company_id", gate.companyId)
    .gte("started_at", from.toISOString())
    .order("started_at", { ascending: false })
    .limit(500)

  if (params.driverId) q = q.eq("driver_id", params.driverId)
  if (params.truckId) q = q.eq("truck_id", params.truckId)
  if (minSec > 0) q = q.gte("duration_seconds", minSec)

  const { data, error } = await q
  if (error) return { data: null, error: safeDbError(error) }
  const rows = (data || []) as unknown[]
  return {
    data: rows.map((r) => {
      const o = r as Record<string, unknown>
      return {
        ...o,
        raw_payload: (typeof o.raw_payload === "object" && o.raw_payload && !Array.isArray(o.raw_payload)
          ? (o.raw_payload as Record<string, unknown>)
          : {}) as Record<string, unknown>,
      } as IdleSession
    }),
    error: null,
  }
}

export async function markEventReviewed(params: {
  eventId: string
  coachingNote?: string
}): Promise<{ data: { reviewed: boolean } | null; error: string | null }> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { error } = await supabase
    .from("eld_harsh_events")
    .update({
      reviewed: true,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      coaching_note: params.coachingNote?.trim() || null,
    })
    .eq("id", params.eventId)
    .eq("company_id", gate.companyId)

  if (error) return { data: null, error: safeDbError(error) }
  return { data: { reviewed: true }, error: null }
}

export async function bulkMarkHarshEventsReviewed(params: {
  eventIds: string[]
  coachingNote?: string
}): Promise<{ data: { updated: number } | null; error: string | null }> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const ids = [...new Set((params.eventIds || []).map(String).filter(Boolean))].slice(0, 200)
  if (ids.length === 0) return { data: { updated: 0 }, error: null }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("eld_harsh_events")
    .update({
      reviewed: true,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      coaching_note: params.coachingNote?.trim() || null,
    })
    .in("id", ids)
    .eq("company_id", gate.companyId)
    .select("id")

  if (error) return { data: null, error: safeDbError(error) }
  return { data: { updated: (data || []).length }, error: null }
}

export async function getHarshEventStats(params: { daysBack?: number }): Promise<{
  data: {
    total: number
    by_type: Record<string, number>
    by_severity: Record<string, number>
    by_driver: Array<{ driver_id: string; driver_name: string; count: number }>
    by_truck: Array<{ truck_id: string; truck_number: string; count: number }>
  } | null
  error: string | null
}> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const days = Math.min(Math.max(1, params.daysBack ?? 7), 365)
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data, error } = await supabase
    .from("eld_harsh_events")
    .select("id, event_type, severity, driver_id, truck_id, driver:drivers(name), truck:trucks(truck_number)")
    .eq("company_id", gate.companyId)
    .gte("occurred_at", from.toISOString())
    .limit(5000)

  if (error) return { data: null, error: safeDbError(error) }

  const by_type: Record<string, number> = {}
  const by_severity: Record<string, number> = {}
  const byDriverMap = new Map<string, { name: string; count: number }>()
  const byTruckMap = new Map<string, { num: string; count: number }>()

  for (const raw of data || []) {
    const row = raw as Record<string, unknown>
    const et = String(row.event_type || "unknown")
    const sev = String(row.severity || "unknown")
    by_type[et] = (by_type[et] || 0) + 1
    by_severity[sev] = (by_severity[sev] || 0) + 1

    const did = row.driver_id ? String(row.driver_id) : ""
    const drel = row.driver as { name?: string | null } | null | undefined
    const dname = (drel && typeof drel === "object" ? String(drel.name || "Driver") : "Driver") || "Driver"
    if (did) {
      const cur = byDriverMap.get(did) || { name: dname, count: 0 }
      cur.count += 1
      byDriverMap.set(did, cur)
    }

    const tid = row.truck_id ? String(row.truck_id) : ""
    const trel = row.truck as { truck_number?: string | null } | null | undefined
    const tnum = (trel && typeof trel === "object" ? String(trel.truck_number || "Truck") : "Truck") || "Truck"
    if (tid) {
      const cur = byTruckMap.get(tid) || { num: tnum, count: 0 }
      cur.count += 1
      byTruckMap.set(tid, cur)
    }
  }

  const by_driver = [...byDriverMap.entries()]
    .map(([driver_id, v]) => ({ driver_id, driver_name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const by_truck = [...byTruckMap.entries()]
    .map(([truck_id, v]) => ({ truck_id, truck_number: v.num, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  return {
    data: {
      total: (data || []).length,
      by_type,
      by_severity,
      by_driver,
      by_truck,
    },
    error: null,
  }
}

export async function getEldSafetyFilterOptions(): Promise<{
  data: { drivers: Array<{ id: string; name: string | null }>; trucks: Array<{ id: string; truck_number: string | null }> } | null
  error: string | null
}> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const [dRes, tRes] = await Promise.all([
    supabase.from("drivers").select("id, name").eq("company_id", gate.companyId).order("name").limit(500),
    supabase.from("trucks").select("id, truck_number").eq("company_id", gate.companyId).order("truck_number").limit(500),
  ])
  if (dRes.error) return { data: null, error: safeDbError(dRes.error) }
  if (tRes.error) return { data: null, error: safeDbError(tRes.error) }
  return {
    data: {
      drivers: (dRes.data || []) as Array<{ id: string; name: string | null }>,
      trucks: (tRes.data || []) as Array<{ id: string; truck_number: string | null }>,
    },
    error: null,
  }
}

export async function getHarshEventCountsForDriver(params: {
  driverId: string
}): Promise<{
  data: { d7: number; d30: number; d90: number } | null
  error: string | null
}> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const now = Date.now()
  const ranges = [
    { key: "d7" as const, ms: 7 * 86400000 },
    { key: "d30" as const, ms: 30 * 86400000 },
    { key: "d90" as const, ms: 90 * 86400000 },
  ]
  const out: { d7: number; d30: number; d90: number } = { d7: 0, d30: 0, d90: 0 }
  for (const r of ranges) {
    const from = new Date(now - r.ms).toISOString()
    const { count, error } = await supabase
      .from("eld_harsh_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", gate.companyId)
      .eq("driver_id", params.driverId)
      .gte("occurred_at", from)
    if (error) return { data: null, error: safeDbError(error) }
    out[r.key] = count ?? 0
  }
  return { data: out, error: null }
}

export async function getIdleSessionSummary(params: { daysBack?: number }): Promise<{
  data: {
    total_idle_hours: number
    total_fuel_gallons: number
    total_fuel_cost_usd: number
    top_trucks: Array<{ truck_id: string; truck_number: string; idle_seconds: number }>
  } | null
  error: string | null
}> {
  const gate = await requireCompanyAndIdleGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const days = Math.min(Math.max(1, params.daysBack ?? 7), 365)
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data, error } = await supabase
    .from("eld_idle_sessions")
    .select("duration_seconds, estimated_fuel_gallons, estimated_fuel_cost_usd, truck_id, truck:trucks(truck_number)")
    .eq("company_id", gate.companyId)
    .gte("started_at", from.toISOString())
    .limit(2000)

  if (error) return { data: null, error: safeDbError(error) }

  let totalSec = 0
  let totalGal = 0
  let totalCost = 0
  const truckIdle = new Map<string, { truck_number: string; idle_seconds: number }>()

  for (const raw of data || []) {
    const row = raw as Record<string, unknown>
    const sec = Number(row.duration_seconds || 0) || 0
    totalSec += sec
    totalGal += Number(row.estimated_fuel_gallons || 0) || 0
    totalCost += Number(row.estimated_fuel_cost_usd || 0) || 0
    const tid = row.truck_id ? String(row.truck_id) : ""
    if (!tid) continue
    const trel = row.truck as { truck_number?: string | null } | null | undefined
    const tnum = (trel && typeof trel === "object" ? String(trel.truck_number || "") : "") || "Truck"
    const cur = truckIdle.get(tid) || { truck_number: tnum, idle_seconds: 0 }
    cur.idle_seconds += sec
    truckIdle.set(tid, cur)
  }

  const top_trucks = [...truckIdle.entries()]
    .map(([truck_id, v]) => ({ truck_id, truck_number: v.truck_number, idle_seconds: v.idle_seconds }))
    .sort((a, b) => b.idle_seconds - a.idle_seconds)
    .slice(0, 5)

  return {
    data: {
      total_idle_hours: Math.round((totalSec / 3600) * 10) / 10,
      total_fuel_gallons: Math.round(totalGal * 1000) / 1000,
      total_fuel_cost_usd: Math.round(totalCost * 100) / 100,
      top_trucks,
    },
    error: null,
  }
}

export async function getHarshEventCountsForTruck(params: {
  truckId: string
}): Promise<{
  data: { d7: number; d30: number; d90: number } | null
  error: string | null
}> {
  const gate = await requireCompanyAndHarshGate()
  if ("error" in gate) return { data: null, error: gate.error }
  const supabase = await createClient()
  const now = Date.now()
  const ranges = [
    { key: "d7" as const, ms: 7 * 86400000 },
    { key: "d30" as const, ms: 30 * 86400000 },
    { key: "d90" as const, ms: 90 * 86400000 },
  ]
  const out: { d7: number; d30: number; d90: number } = { d7: 0, d30: 0, d90: 0 }
  for (const r of ranges) {
    const from = new Date(now - r.ms).toISOString()
    const { count, error } = await supabase
      .from("eld_harsh_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", gate.companyId)
      .eq("truck_id", params.truckId)
      .gte("occurred_at", from)
    if (error) return { data: null, error: safeDbError(error) }
    out[r.key] = count ?? 0
  }
  return { data: out, error: null }
}
