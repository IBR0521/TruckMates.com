"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { safeDbError } from "@/lib/utils/error"
import { revalidatePath } from "next/cache"

export type FaultCode = {
  id: string
  code: string
  code_protocol: string
  description: string | null
  long_description: string | null
  severity: string
  category: string | null
  recommended_action: string | null
  truck_id: string | null
  truck_number: string | null
  driver_id: string | null
  first_seen_at: string
  last_seen_at: string
  occurrence_count: number
  is_active: boolean
  acknowledged_at: string | null
  resolved_at: string | null
  resolution_notes: string | null
  linked_maintenance_id: string | null
  estimated_repair_cost_low_usd: number | null
  estimated_repair_cost_high_usd: number | null
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

async function ensureFaultCodesGate(): Promise<
  { companyId: string; advanced: boolean } | { error: string }
> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }
  const basic = await checkFeatureAccess({
    companyId: ctx.companyId,
    feature: "eld_fault_codes_basic",
  })
  if (!basic.allowed) {
    return { error: "Engine fault codes are not available on your plan." }
  }
  const advanced = await checkFeatureAccess({
    companyId: ctx.companyId,
    feature: "eld_fault_codes_advanced",
  })
  return { companyId: ctx.companyId, advanced: advanced.allowed }
}

function mapRow(raw: unknown, advanced: boolean): FaultCode {
  const o = asRecord(raw)
  const trucks = asRecord(o.trucks)
  return {
    id: String(o.id ?? ""),
    code: String(o.code ?? ""),
    code_protocol: String(o.code_protocol ?? "unknown"),
    description: advanced && o.description != null ? String(o.description) : null,
    long_description: null,
    severity: String(o.severity ?? "unknown"),
    category: advanced && o.category != null ? String(o.category) : null,
    recommended_action:
      advanced && o.recommended_action != null ? String(o.recommended_action) : null,
    truck_id: o.truck_id == null ? null : String(o.truck_id),
    truck_number:
      trucks.truck_number == null ? null : String(trucks.truck_number),
    driver_id: o.driver_id == null ? null : String(o.driver_id),
    first_seen_at: String(o.first_seen_at ?? ""),
    last_seen_at: String(o.last_seen_at ?? ""),
    occurrence_count: Number(o.occurrence_count ?? 1),
    is_active: o.is_active !== false,
    acknowledged_at: o.acknowledged_at == null ? null : String(o.acknowledged_at),
    resolved_at: o.resolved_at == null ? null : String(o.resolved_at),
    resolution_notes: o.resolution_notes == null ? null : String(o.resolution_notes),
    linked_maintenance_id:
      o.linked_maintenance_id == null ? null : String(o.linked_maintenance_id),
    estimated_repair_cost_low_usd: null,
    estimated_repair_cost_high_usd: null,
  }
}

export async function listActiveFaultCodes(params?: {
  severity?: string[]
  truckId?: string
  category?: string
  status?: "active" | "acknowledged" | "resolved" | "all"
  limit?: number
}): Promise<{ data: FaultCode[] | null; error: string | null }> {
  const gate = await ensureFaultCodesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const lim = Math.min(Math.max(params?.limit ?? 200, 1), 500)

  let q = supabase
    .from("eld_fault_codes")
    .select(
      "id, code, code_protocol, description, severity, category, recommended_action, truck_id, driver_id, first_seen_at, last_seen_at, occurrence_count, is_active, acknowledged_at, resolved_at, resolution_notes, linked_maintenance_id, trucks(truck_number)",
    )
    .eq("company_id", gate.companyId)
    .order("last_seen_at", { ascending: false })
    .limit(lim)

  const status = params?.status ?? "active"
  if (status === "active") {
    q = q.eq("is_active", true).is("resolved_at", null)
  } else if (status === "acknowledged") {
    q = q.not("acknowledged_at", "is", null).is("resolved_at", null)
  } else if (status === "resolved") {
    q = q.not("resolved_at", "is", null)
  }

  if (params?.truckId) q = q.eq("truck_id", params.truckId)
  if (params?.category) q = q.eq("category", params.category)
  if (params?.severity?.length) q = q.in("severity", params.severity)

  const { data, error } = await q
  if (error) return { data: null, error: safeDbError(error) }

  const rows = (data ?? []).map((r: unknown) => mapRow(r, gate.advanced))
  return { data: rows, error: null }
}

export async function getFaultCodeHistory(params: {
  truckId: string
  daysBack?: number
  includeResolved?: boolean
}): Promise<{ data: FaultCode[] | null; error: string | null }> {
  const gate = await ensureFaultCodesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const days = Math.min(Math.max(params.daysBack ?? 90, 1), 365)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  let q = supabase
    .from("eld_fault_codes")
    .select(
      "id, code, code_protocol, description, severity, category, recommended_action, truck_id, driver_id, first_seen_at, last_seen_at, occurrence_count, is_active, acknowledged_at, resolved_at, resolution_notes, linked_maintenance_id, trucks(truck_number)",
    )
    .eq("company_id", gate.companyId)
    .eq("truck_id", params.truckId)
    .gte("first_seen_at", since)
    .order("first_seen_at", { ascending: false })
    .limit(300)

  if (!params.includeResolved) {
    q = q.is("resolved_at", null)
  }

  const { data, error } = await q
  if (error) return { data: null, error: safeDbError(error) }
  return { data: (data ?? []).map((r: unknown) => mapRow(r, gate.advanced)), error: null }
}

export async function acknowledgeFaultCode(params: {
  faultCodeId: string
}): Promise<{ data: { acknowledged: boolean } | null; error: string | null }> {
  const gate = await ensureFaultCodesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { error } = await supabase
    .from("eld_fault_codes")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.faultCodeId)
    .eq("company_id", gate.companyId)

  if (error) return { data: null, error: safeDbError(error) }
  revalidatePath("/dashboard/eld/health")
  return { data: { acknowledged: true }, error: null }
}

export async function resolveFaultCode(params: {
  faultCodeId: string
  resolutionNotes: string
}): Promise<{ data: { resolved: boolean } | null; error: string | null }> {
  const gate = await ensureFaultCodesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const notes = params.resolutionNotes.trim()
  if (notes.length < 10) {
    return { data: null, error: "Resolution notes must be at least 10 characters." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { error } = await supabase
    .from("eld_fault_codes")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_notes: notes,
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.faultCodeId)
    .eq("company_id", gate.companyId)

  if (error) return { data: null, error: safeDbError(error) }
  revalidatePath("/dashboard/eld/health")
  return { data: { resolved: true }, error: null }
}

export async function getFaultCodeStats(params: {
  daysBack: number
}): Promise<{
  data: {
    total_active: number
    by_severity: Record<string, number>
    by_category: Record<string, number>
    top_codes: Array<{ code: string; description: string; count: number }>
    trucks_with_issues: number
    avg_resolution_time_hours: number
  } | null
  error: string | null
}> {
  const gate = await ensureFaultCodesGate()
  if ("error" in gate) return { data: null, error: gate.error }

  const supabase = await createClient()
  const days = Math.min(Math.max(params.daysBack, 1), 90)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data: active, error } = await supabase
    .from("eld_fault_codes")
    .select("id, code, description, severity, category, truck_id, resolved_at, first_seen_at")
    .eq("company_id", gate.companyId)
    .eq("is_active", true)
    .is("resolved_at", null)

  if (error) return { data: null, error: safeDbError(error) }

  const rows = active ?? []
  const by_severity: Record<string, number> = {}
  const by_category: Record<string, number> = {}
  const codeCounts = new Map<string, { description: string; count: number }>()
  const trucks = new Set<string>()

  for (const raw of rows) {
    const o = asRecord(raw)
    const sev = String(o.severity ?? "unknown")
    by_severity[sev] = (by_severity[sev] ?? 0) + 1
    const cat = String(o.category ?? "unknown")
    by_category[cat] = (by_category[cat] ?? 0) + 1
    const code = String(o.code ?? "")
    const desc = gate.advanced && o.description ? String(o.description) : code
    const prev = codeCounts.get(code) ?? { description: desc, count: 0 }
    codeCounts.set(code, { description: desc, count: prev.count + 1 })
    if (o.truck_id) trucks.add(String(o.truck_id))
  }

  const { data: resolved } = await supabase
    .from("eld_fault_codes")
    .select("first_seen_at, resolved_at")
    .eq("company_id", gate.companyId)
    .not("resolved_at", "is", null)
    .gte("resolved_at", since)

  let avg_resolution_time_hours = 0
  const resolvedRows = resolved ?? []
  if (resolvedRows.length > 0) {
    let totalH = 0
    for (const r of resolvedRows) {
      const o = asRecord(r)
      const a = new Date(String(o.first_seen_at)).getTime()
      const b = new Date(String(o.resolved_at)).getTime()
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
        totalH += (b - a) / 3600000
      }
    }
    avg_resolution_time_hours = Math.round((totalH / resolvedRows.length) * 10) / 10
  }

  const top_codes = [...codeCounts.entries()]
    .map(([code, v]) => ({ code, description: v.description, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    data: {
      total_active: rows.length,
      by_severity,
      by_category,
      top_codes,
      trucks_with_issues: trucks.size,
      avg_resolution_time_hours,
    },
    error: null,
  }
}
