import { createAdminClient } from "@/lib/supabase/admin"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"

export type ProactiveAlert = {
  alert_type: string
  alert_key: string
  priority: "critical" | "high" | "medium"
  title: string
  body: string
  details: Record<string, unknown>
  affected_resource_type: string | null
  affected_resource_id: string | null
}

function parseCoord(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  const lat = typeof o.lat === "number" ? o.lat : typeof o.latitude === "number" ? o.latitude : Number(o.lat)
  const lng = typeof o.lng === "number" ? o.lng : typeof o.longitude === "number" ? o.longitude : Number(o.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Miles between two WGS84 points (great-circle). */
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.7613
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

export async function detectLateDeliveryRisk(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const today = new Date()
  const isoDate = today.toISOString().slice(0, 10)
  const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)

  const { data: loads, error } = await admin
    .from("loads")
    .select("id, shipment_number, status, estimated_delivery, coordinates, destination")
    .eq("company_id", companyId)
    .eq("status", "in_transit")
    .not("estimated_delivery", "is", null)
    .lte("estimated_delivery", tomorrow)
    .limit(80)

  if (error || !loads?.length) return []

  const out: ProactiveAlert[] = []
  for (const row of loads as Array<{
    id: string
    shipment_number?: string | null
    estimated_delivery?: string | null
    coordinates?: unknown
    destination?: string | null
  }>) {
    const ed = row.estimated_delivery ? String(row.estimated_delivery).slice(0, 10) : ""
    if (!ed) continue

    const coords = parseCoord(row.coordinates)
    let hoursLate = 0
    if (coords && row.destination) {
      const destApprox = geocodeTextHint(row.destination)
      if (destApprox) {
        const miles = haversineMiles(coords, destApprox)
        const driveHrs = miles / 45
        const endOfDay = new Date(`${ed}T23:59:59.000Z`).getTime()
        const eta = Date.now() + driveHrs * 3600000
        hoursLate = (eta - endOfDay) / 3600000
      }
    }

    const pastDue = ed < isoDate
    const riskyEta = hoursLate > 2

    if (pastDue || riskyEta) {
      out.push({
        alert_type: "late_delivery_predicted",
        alert_key: `load_${row.id}`,
        priority: pastDue ? "critical" : "high",
        title: pastDue ? "Delivery window may be missed" : "Late delivery risk",
        body: pastDue
          ? `Load ${row.shipment_number || row.id} has an estimated delivery of ${ed} that is already in the past while still in transit.`
          : `Load ${row.shipment_number || row.id} may arrive more than 2 hours after the delivery commitment based on straight-line distance and 45 mph heuristic.`,
        details: {
          load_id: row.id,
          shipment_number: row.shipment_number,
          estimated_delivery: ed,
          heuristic_hours_late: Math.round(hoursLate * 10) / 10,
        },
        affected_resource_type: "load",
        affected_resource_id: row.id,
      })
    }
  }
  return out
}

/** Very rough centroid hints for common US city tokens (fallback when no coords). */
function geocodeTextHint(text: string): { lat: number; lng: number } | null {
  const t = text.toLowerCase()
  const hints: Array<{ k: string; lat: number; lng: number }> = [
    { k: "chicago", lat: 41.8781, lng: -87.6298 },
    { k: "dallas", lat: 32.7767, lng: -96.797 },
    { k: "atlanta", lat: 33.749, lng: -84.388 },
    { k: "los angeles", lat: 34.0522, lng: -118.2437 },
    { k: "houston", lat: 29.7604, lng: -95.3698 },
    { k: "phoenix", lat: 33.4484, lng: -112.074 },
  ]
  for (const h of hints) {
    if (t.includes(h.k)) return { lat: h.lat, lng: h.lng }
  }
  return null
}

export async function detectProfitAtRisk(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const { data: loads, error } = await admin
    .from("loads")
    .select("id, shipment_number, status, total_rate, rate")
    .eq("company_id", companyId)
    .in("status", ["in_transit", "scheduled", "confirmed"])
    .limit(100)

  if (error || !loads?.length) return []

  const out: ProactiveAlert[] = []
  for (const row of loads as Array<{
    id: string
    shipment_number?: string | null
    total_rate?: number | null
    rate?: number | null
  }>) {
    const negotiated = Number(row.total_rate ?? row.rate ?? 0)
    if (!negotiated || negotiated <= 0) continue

    const { data: exp } = await admin.from("expenses").select("amount").eq("company_id", companyId).eq("load_id", row.id)

    let sum = 0
    for (const e of (exp || []) as Array<{ amount?: number | null }>) {
      sum += Number(e.amount || 0)
    }

    if (sum / negotiated >= 0.8) {
      const margin = negotiated - sum
      out.push({
        alert_type: "profit_at_risk",
        alert_key: `load_${row.id}`,
        priority: margin <= 0 ? "critical" : "high",
        title: "Profit margin thin on active load",
        body: `Recorded expenses (~$${sum.toFixed(0)}) are about ${Math.round((sum / negotiated) * 100)}% of the negotiated rate on load ${row.shipment_number || row.id}; about $${margin.toFixed(0)} margin remains.`,
        details: { load_id: row.id, expenses: sum, rate: negotiated },
        affected_resource_type: "load",
        affected_resource_id: row.id,
      })
    }
  }
  return out
}

export async function detectCapacityGap(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const start = new Date().toISOString().slice(0, 10)
  const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: byDay, error } = await admin
    .from("loads")
    .select("load_date")
    .eq("company_id", companyId)
    .in("status", ["pending", "confirmed", "scheduled"])
    .gte("load_date", start)
    .lte("load_date", end)

  if (error || !byDay?.length) return []

  const counts = new Map<string, number>()
  for (const r of byDay as Array<{ load_date?: string | null }>) {
    const d = r.load_date ? String(r.load_date).slice(0, 10) : ""
    if (!d) continue
    counts.set(d, (counts.get(d) || 0) + 1)
  }

  const { count: driverCount } = await admin
    .from("drivers")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", ["active", "on_route", "off_duty"])

  const cap = Math.max(1, (driverCount || 0) * 2)
  const out: ProactiveAlert[] = []
  for (const [day, n] of counts) {
    if (n > cap) {
      out.push({
        alert_type: "capacity_gap",
        alert_key: `day_${day}`,
        priority: "medium",
        title: `Capacity pressure on ${day}`,
        body: `${n} loads are scheduled with pickup on ${day}, while roughly ${cap} active-driver capacity slots are available (2 loads/driver heuristic).`,
        details: { date: day, scheduled_loads: n, capacity_slots: cap },
        affected_resource_type: null,
        affected_resource_id: null,
      })
    }
  }
  return out
}

export async function detectStaleQuotes(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString()

  const { data: rows, error } = await admin
    .from("load_marketplace")
    .select("id, origin, destination, status, created_at")
    .eq("broker_id", companyId)
    .eq("status", "available")
    .lt("created_at", cutoff)
    .limit(40)

  if (error || !rows?.length) return []

  return (rows as Array<{ id: string; origin?: string; destination?: string }>).map((r) => ({
    alert_type: "stale_marketplace_listing",
    alert_key: `marketplace_${r.id}`,
    priority: "medium" as const,
    title: "Marketplace listing getting stale",
    body: `Listing ${r.id.slice(0, 8)}… (${r.origin || "?"} → ${r.destination || "?"}) has been available for over 48 hours with no match.`,
    details: { marketplace_id: r.id },
    affected_resource_type: "marketplace_listing",
    affected_resource_id: r.id,
  }))
}

export async function detectIdleAssets(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: trucks, error } = await admin
    .from("trucks")
    .select("id, truck_number, status, updated_at")
    .eq("company_id", companyId)
    .eq("status", "available")
    .lt("updated_at", cutoff)
    .limit(60)

  if (error || !trucks?.length) return []

  const { data: activeLoads } = await admin
    .from("loads")
    .select("truck_id")
    .eq("company_id", companyId)
    .in("status", ["scheduled", "in_transit", "confirmed"])
    .not("truck_id", "is", null)

  const busy = new Set((activeLoads || []).map((r: { truck_id: string }) => String(r.truck_id)))

  const out: ProactiveAlert[] = []
  for (const t of trucks as Array<{ id: string; truck_number?: string | null }>) {
    if (busy.has(t.id)) continue
    const label = t.truck_number || t.id
    out.push({
      alert_type: "idle_truck",
      alert_key: `truck_${t.id}`,
      priority: "medium",
      title: `Truck ${label} has been idle`,
      body: `Unit ${label} has been in "available" status with no dispatch updates for over 7 days — confirm utilization or yard status.`,
      details: { truck_id: t.id },
      affected_resource_type: "truck",
      affected_resource_id: t.id,
    })
  }
  return out
}

export async function detectCoachingFollowUps(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const { data: co } = await admin
    .from("companies")
    .select("subscription_tier")
    .eq("id", companyId)
    .maybeSingle()
  const tier: PlanTier = normalizePlanTier((co as { subscription_tier?: string | null } | null)?.subscription_tier)
  if (!hasFeatureAccess(tier, "driver_safety_scorecards")) return []

  const today = new Date().toISOString().slice(0, 10)
  const { data: sessions, error } = await admin
    .from("driver_coaching_sessions")
    .select("id, driver_id, follow_up_date")
    .eq("company_id", companyId)
    .eq("follow_up_date", today)
    .eq("follow_up_completed", false)
    .limit(80)

  if (error || !sessions?.length) return []

  const ids = [...new Set((sessions as Array<{ driver_id: string }>).map((s) => s.driver_id))]
  const { data: drivers } = await admin.from("drivers").select("id, name").in("id", ids)
  const names = new Map((drivers || []).map((d: { id: string; name: string | null }) => [d.id, d.name || "Driver"]))

  return (sessions as Array<{ id: string; driver_id: string }>).map((s) => {
    const label = names.get(s.driver_id) || "Driver"
    return {
      alert_type: "coaching_follow_up_due",
      alert_key: `coaching_session_${s.id}`,
      priority: "medium" as const,
      title: "Coaching follow-up due",
      body: `${label} has a coaching follow-up scheduled for today. When you have completed the check-in, mark the follow-up complete on the driver Safety tab.`,
      details: { coaching_session_id: s.id, driver_id: s.driver_id, follow_up_date: today },
      affected_resource_type: "driver",
      affected_resource_id: s.driver_id,
    }
  })
}

export async function detectComplianceTimebomb(companyId: string): Promise<ProactiveAlert[]> {
  const admin = createAdminClient()
  const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: drivers, error } = await admin
    .from("drivers")
    .select("id, name, license_expiry")
    .eq("company_id", companyId)
    .gte("license_expiry", start)
    .lte("license_expiry", end)
    .limit(80)

  if (error || !drivers?.length) return []

  const out: ProactiveAlert[] = []
  for (const d of drivers as Array<{ id: string; name?: string | null; license_expiry?: string | null }>) {
    const { data: reminder } = await admin
      .from("reminders")
      .select("id")
      .eq("company_id", companyId)
      .eq("driver_id", d.id)
      .eq("reminder_type", "license_renewal")
      .in("status", ["pending", "sent"])
      .limit(1)
      .maybeSingle()

    if (reminder?.id) continue

    out.push({
      alert_type: "compliance_expiry",
      alert_key: `driver_license_${d.id}`,
      priority: "high",
      title: "CDL renewal approaching",
      body: `Driver ${d.name || d.id} CDL expires on ${d.license_expiry} and no license renewal reminder is on file.`,
      details: { driver_id: d.id, license_expiry: d.license_expiry },
      affected_resource_type: "driver",
      affected_resource_id: d.id,
    })
  }
  return out
}

export async function generateProactiveAlerts(params: { companyId: string }): Promise<{
  data: ProactiveAlert[] | null
  error: string | null
  tokensUsed: number
  costUsd: number
}> {
  try {
    const chunks = await Promise.all([
      detectLateDeliveryRisk(params.companyId),
      detectProfitAtRisk(params.companyId),
      detectCapacityGap(params.companyId),
      detectStaleQuotes(params.companyId),
      detectIdleAssets(params.companyId),
      detectComplianceTimebomb(params.companyId),
      detectCoachingFollowUps(params.companyId),
    ])
    const merged = chunks.flat()
    return { data: merged, error: null, tokensUsed: 0, costUsd: 0 }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proactive detection failed"
    return { data: null, error: msg, tokensUsed: 0, costUsd: 0 }
  }
}
