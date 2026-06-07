import { createAdminClient } from "@/lib/supabase/admin"
import { createLoad, duplicateLoad, updateLoad } from "@/app/actions/loads"
import { quickAssignLoad } from "@/app/actions/dispatches"
import { sendInvoiceEmail } from "@/app/actions/invoice-email"
import { updateInvoice } from "@/app/actions/accounting"
import { sendSMSToDriver } from "@/app/actions/sms"
import { updateDriver } from "@/app/actions/drivers"
import { createMaintenance, updateMaintenanceStatus } from "@/app/actions/maintenance"
import { callClaude } from "@/lib/ai/client"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import type { AiToolContext, AiToolExecuteResult, AiToolPreviewResult } from "@/lib/ai/tools/types"
import { blockedPreview } from "@/lib/ai/tools/types"
import { isAiDispatchPlannerExperimentalEnabled } from "@/lib/ai/feature-flags"
import { normalizePlanTier, tierAtLeast } from "@/lib/plan-limits"

function isDispatchPlannerEnabled(): boolean {
  return isAiDispatchPlannerExperimentalEnabled()
}

type PlannerLoad = {
  id: string
  shipment_number: string | null
  origin: string | null
  destination: string | null
  load_date: string | null
  estimated_delivery: string | null
  is_hazardous: boolean | null
  weight: string | null
}

type PlannerDriver = {
  id: string
  name: string | null
  status: string | null
  license_endorsements: string | null
  hos_drive_left_hr: number | null
  hos_onduty_left_hr: number | null
  duty_status_hint: string | null
}

type PlannerTruck = { id: string; truck_number: string | null; status: string | null; current_location: string | null }

type DispatchPlan = {
  confidence: number // 0..1
  assumptions: string[]
  assignments: Array<{
    load_id: string
    driver_id: string
    truck_id: string | null
    reasoning: string
    constraints: {
      hos_ok: boolean
      hazmat_ok: boolean
      deadhead_note: string | null
    }
    confidence: number // 0..1
  }>
}

const DISPATCH_PLAN_SCHEMA = `Return ONLY valid JSON (no markdown) matching:\n{\n  \"confidence\": number, // 0..1 overall\n  \"assumptions\": string[],\n  \"assignments\": [\n    {\n      \"load_id\": string,\n      \"driver_id\": string,\n      \"truck_id\": string | null,\n      \"reasoning\": string,\n      \"constraints\": {\n        \"hos_ok\": boolean,\n        \"hazmat_ok\": boolean,\n        \"deadhead_note\": string | null\n      },\n      \"confidence\": number // 0..1\n    }\n  ]\n}`

function clamp01(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function parseDispatchPlan(raw: unknown): DispatchPlan {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const assumptions = Array.isArray(o.assumptions) ? (o.assumptions as unknown[]).map((x) => String(x || "")).filter(Boolean) : []
  const assignmentsRaw = Array.isArray(o.assignments) ? o.assignments : []
  const assignments: DispatchPlan["assignments"] = []
  for (const a of assignmentsRaw) {
    const r = a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {}
    const constraintsRaw =
      r.constraints && typeof r.constraints === "object" && !Array.isArray(r.constraints)
        ? (r.constraints as Record<string, unknown>)
        : {}
    const load_id = String(r.load_id || "").trim()
    const driver_id = String(r.driver_id || "").trim()
    if (!load_id || !driver_id) continue
    assignments.push({
      load_id,
      driver_id,
      truck_id: r.truck_id ? String(r.truck_id) : null,
      reasoning: String(r.reasoning || "").trim(),
      constraints: {
        hos_ok: Boolean(constraintsRaw.hos_ok),
        hazmat_ok: Boolean(constraintsRaw.hazmat_ok),
        deadhead_note: constraintsRaw.deadhead_note ? String(constraintsRaw.deadhead_note) : null,
      },
      confidence: clamp01(r.confidence),
    })
  }
  return { confidence: clamp01(o.confidence), assumptions, assignments }
}

function buildFallbackPlan(loads: PlannerLoad[], drivers: PlannerDriver[], trucks: PlannerTruck[]): DispatchPlan {
  const assignments: DispatchPlan["assignments"] = []
  const hazmatDrivers = drivers.filter((d) => String(d.license_endorsements || "").toUpperCase().includes("H"))
  let di = 0
  let ti = 0
  for (const load of loads.slice(0, 15)) {
    const isHaz = Boolean(load.is_hazardous)
    const pool = isHaz && hazmatDrivers.length ? hazmatDrivers : drivers
    if (!pool.length) continue
    const driver = pool[di % pool.length]
    di++
    const truck = trucks.length ? trucks[ti++ % trucks.length] : null
    assignments.push({
      load_id: String(load.id),
      driver_id: String(driver.id),
      truck_id: truck ? String(truck.id) : null,
      reasoning: "Round-robin assignment (AI planner returned no plan); HOS/endorsements unverified.",
      constraints: { hos_ok: false, hazmat_ok: isHaz ? hazmatDrivers.length > 0 : true, deadhead_note: null },
      confidence: 0.3,
    })
  }
  return {
    confidence: 0.3,
    assignments,
    assumptions: [
      "Fallback round-robin plan — the AI planner returned no assignments. HOS not verified (no ELD connected); dispatcher must confirm hours and endorsements before dispatch.",
    ],
  }
}

async function loadPlannerInputs(companyId: string): Promise<{
  loads: PlannerLoad[]
  drivers: PlannerDriver[]
  trucks: PlannerTruck[]
  missing: string[]
  error: string | null
}> {
  const admin = createAdminClient()
  const missing: string[] = []

  const { data: loadsRaw, error: loadsError } = await admin
    .from("loads")
    .select("id, shipment_number, origin, destination, load_date, estimated_delivery, is_hazardous, weight, status, driver_id")
    .eq("company_id", companyId)
    .is("driver_id", null)
    .in("status", ["pending", "scheduled", "confirmed"])
    .order("updated_at", { ascending: false })
    .limit(15)
  if (loadsError) {
    return { loads: [], drivers: [], trucks: [], missing: [], error: loadsError.message }
  }
  const loads = (loadsRaw || []) as unknown as PlannerLoad[]

  const { data: driversRaw, error: driversError } = await admin
    .from("drivers")
    .select("id, name, status, license_endorsements")
    .eq("company_id", companyId)
    .not("status", "in", '("inactive")')
    .limit(15)
  if (driversError) {
    return { loads, drivers: [], trucks: [], missing: [], error: driversError.message }
  }
  const baseDrivers = (driversRaw || []) as Array<{
    id: string
    name: string | null
    status: string | null
    license_endorsements: string | null
  }>

  const driverIds = baseDrivers.map((d) => d.id)
  const { data: hosRaw } = driverIds.length
    ? await admin
        .from("eld_hos_clocks")
        .select("driver_id, remaining_drive_ms, remaining_shift_ms, updated_at")
        .eq("company_id", companyId)
        .in("driver_id", driverIds)
        .order("updated_at", { ascending: false })
        .limit(2000)
    : { data: null as unknown }

  // newest clock per driver
  const hosByDriver = new Map<string, { driveHr: number | null; onDutyHr: number | null }>()
  for (const r of (hosRaw || []) as Array<{ driver_id?: string | null; remaining_drive_ms?: number | null; remaining_shift_ms?: number | null }>) {
    const id = String(r.driver_id || "")
    if (!id || hosByDriver.has(id)) continue
    const driveHr = r.remaining_drive_ms != null ? Number(r.remaining_drive_ms) / 3600000 : null
    const onDutyHr = r.remaining_shift_ms != null ? Number(r.remaining_shift_ms) / 3600000 : null
    hosByDriver.set(id, {
      driveHr: Number.isFinite(Number(driveHr)) ? driveHr : null,
      onDutyHr: Number.isFinite(Number(onDutyHr)) ? onDutyHr : null,
    })
  }
  if (driverIds.length > 0 && hosByDriver.size === 0) missing.push("HOS clocks (eld_hos_clocks) are missing; HOS feasibility is approximate.")

  const drivers: PlannerDriver[] = baseDrivers.map((d) => {
    const hos = hosByDriver.get(d.id)
    return {
      ...d,
      hos_drive_left_hr: hos?.driveHr ?? null,
      hos_onduty_left_hr: hos?.onDutyHr ?? null,
      duty_status_hint: null,
    }
  })

  const { data: trucksRaw, error: trucksError } = await admin
    .from("trucks")
    .select("id, truck_number, status, current_location")
    .eq("company_id", companyId)
    .in("status", ["available", "idle", "active"])
    .limit(15)
  if (trucksError) {
    return { loads, drivers, trucks: [], missing: [], error: trucksError.message }
  }
  const trucks = (trucksRaw || []) as unknown as PlannerTruck[]

  if (loads.length === 0) {
    const { count } = await admin.from("loads").select("id", { count: "exact", head: true }).eq("company_id", companyId)
    missing.push(
      `No unassigned loads found (need driver_id IS NULL and status in pending/scheduled/confirmed). Found ${count ?? 0} total loads for this company.`,
    )
  }
  if (drivers.length === 0) {
    const { count } = await admin.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", companyId)
    missing.push(
      `No assignable drivers found (excluding inactive). Found ${count ?? 0} drivers total.`,
    )
  }
  if (trucks.length === 0) {
    const { count } = await admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId)
    missing.push(
      `No available trucks found (status in available/idle/active). Found ${count ?? 0} trucks total.`,
    )
  }

  return { loads, drivers, trucks, missing, error: null }
}

async function proposeDispatchPlanViaModel(params: {
  companyId: string
  loads: PlannerLoad[]
  drivers: PlannerDriver[]
  trucks: PlannerTruck[]
  missing: string[]
}): Promise<{ plan: DispatchPlan | null; error: string | null }> {
  const userBlock = [
    "You are a dispatch planner. Propose a plan to assign drivers (and trucks when available) to unassigned loads.",
    "Hard constraints:",
    "- This plan is a PROPOSAL that a human dispatcher must approve before anything is applied. Never return an empty plan when assignable loads and active drivers both exist. When HOS data is missing or unverified, STILL propose the assignment, set constraints.hos_ok=false, and add an assumption like 'HOS not available — dispatcher must confirm hours before dispatch.' Only omit a driver if there is positive evidence they cannot run.",
    "- Hazmat: if a load is hazardous, assign drivers with confirmed endorsement 'H' (HAZMAT) and set constraints.hazmat_ok=true. If endorsements are unknown, still propose the assignment, set constraints.hazmat_ok=false, and add an assumption to verify the HAZMAT endorsement — do not silently drop hazmat loads.",
    "- Do NOT invent IDs. Use only IDs provided below.",
    "Optimization goals (best-effort): minimize deadhead when truck locations exist; driver proximity is not available in this pass.",
    "Keep reasoning concise (dispatchers are busy).",
    "Produce at least one assignment per unassigned load you can reasonably cover with an available driver. An empty assignments array is only acceptable if there are genuinely zero drivers or zero loads.",
    "",
    DISPATCH_PLAN_SCHEMA,
    "",
    "Missing / limitations (must incorporate into assumptions):",
    ...params.missing.map((m) => `- ${m}`),
    "",
    "Unassigned loads (max 15):",
    JSON.stringify(params.loads),
    "",
    "Available drivers (max 15):",
    JSON.stringify(params.drivers),
    "",
    "Available trucks (max 15):",
    JSON.stringify(params.trucks),
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(
    `${LOGISTICS_SYSTEM_PROMPT}\n\nReturn a dispatch assignment plan as strict JSON.`,
    userBlock,
    {
      expectJson: true,
      maxTokens: 1600,
      model: "sonnet",
      feature: "dispatch_planner",
      companyId: params.companyId,
      cacheSystemPrompt: true,
    },
  )

  console.error("[DISPATCH_PLANNER] raw model response:", JSON.stringify(res.data), "error:", res.error)

  if (res.error || !res.data) return { plan: null, error: res.error || "Planner unavailable" }
  return { plan: parseDispatchPlan(res.data), error: null }
}

export async function previewDispatchPlanner(
  input: Record<string, unknown>,
  ctx: AiToolContext,
): Promise<AiToolPreviewResult> {
  void input

  if (!isDispatchPlannerEnabled()) {
    return blockedPreview("Dispatch planner is unavailable (feature not enabled for this environment).")
  }

  const admin = createAdminClient()
  const { data: companyRow } = await admin.from("companies").select("subscription_tier").eq("id", ctx.companyId).maybeSingle()
  const tier = normalizePlanTier((companyRow as { subscription_tier?: string } | null)?.subscription_tier)
  if (!tierAtLeast(tier, "fleet")) {
    return blockedPreview("Dispatch planner requires a Fleet subscription.")
  }

  const { loads, drivers, trucks, missing, error: inputsError } = await loadPlannerInputs(ctx.companyId)
  if (inputsError) {
    return blockedPreview(`Could not load fleet data for planning: ${inputsError}`)
  }
  const { plan, error } = await proposeDispatchPlanViaModel({ companyId: ctx.companyId, loads, drivers, trucks, missing })
  let finalPlan = plan
  if ((!finalPlan || finalPlan.assignments.length === 0) && loads.length > 0 && drivers.length > 0) {
    finalPlan = buildFallbackPlan(loads, drivers, trucks)
  }
  if (!finalPlan || finalPlan.assignments.length === 0) {
    return blockedPreview(error || "No assignable loads or drivers are available.")
  }

  const toApply = finalPlan.assignments.slice(0, 15)
  const loadById = new Map(loads.map((l) => [String(l.id), l]))
  const driverById = new Map(drivers.map((d) => [String(d.id), d]))
  const truckById = new Map(trucks.map((t) => [String(t.id), t]))
  const loadLabel = (id: string) => {
    const l = loadById.get(id)
    if (!l) return `Load ${id.slice(0, 8)}`
    const lane = l.origin && l.destination ? ` (${l.origin} → ${l.destination})` : ""
    return `Load ${l.shipment_number || id.slice(0, 8)}${lane}`
  }
  const driverName = (id: string) => driverById.get(id)?.name || `driver ${id.slice(0, 8)}`
  const truckLabel = (id: string | null) => {
    if (!id) return null
    const t = truckById.get(id)
    return t?.truck_number ? `truck ${t.truck_number}` : `truck ${id.slice(0, 8)}`
  }

  const lines = toApply.map((a, i) => {
    const truck = truckLabel(a.truck_id)
    return `${i + 1}. ${loadLabel(a.load_id)} → ${driverName(a.driver_id)}${truck ? ` · ${truck}` : ""}`
  })
  const summary = [
    `Proposed dispatch plan (${toApply.length} assignments).`,
    ...lines,
    finalPlan.assumptions.length ? "" : "",
    finalPlan.assumptions.length ? "Assumptions:" : "",
    ...finalPlan.assumptions.slice(0, 4).map((a) => `- ${a}`),
  ]
    .filter(Boolean)
    .join("\n")

  return {
    summary,
    affected: toApply.map((a) => ({ type: "load", id: a.load_id, label: loadLabel(a.load_id) })),
    draftInput: { plan: finalPlan, generated_at: new Date().toISOString() },
  }
}

export async function execDispatchPlanner(
  input: Record<string, unknown>,
  ctx: AiToolContext,
): Promise<AiToolExecuteResult<{ applied: number; results: Array<{ load_id: string; ok: boolean; error?: string }> }>> {
  if (!isDispatchPlannerEnabled()) {
    return { ok: false, error: "Dispatch planner is disabled." }
  }

  const plan = (input.plan && typeof input.plan === "object" && !Array.isArray(input.plan) ? (input.plan as DispatchPlan) : null)
  if (!plan || !Array.isArray(plan.assignments) || plan.assignments.length === 0) {
    return { ok: false, error: "No plan found to apply. Re-run planning." }
  }

  // Execute via existing dispatch helper so all side effects are consistent.
  const results: Array<{ load_id: string; ok: boolean; error?: string }> = []
  let applied = 0
  for (const a of plan.assignments.slice(0, 15)) {
    const load_id = String((a as any).load_id || "").trim()
    const driver_id = String((a as any).driver_id || "").trim()
    if (!load_id || !driver_id) continue

    try {
      const res = await quickAssignLoad(load_id, driver_id, (a as any).truck_id ? String((a as any).truck_id) : undefined)
      if ((res as any)?.error) {
        results.push({ load_id, ok: false, error: String((res as any).error) })
      } else {
        applied += 1
        results.push({ load_id, ok: true })
      }
    } catch (e: unknown) {
      results.push({ load_id, ok: false, error: e instanceof Error ? e.message : "Assign failed" })
    }
  }

  return { ok: true, data: { applied, results } }
}

export async function getInvoiceIdForLoadOrInvoice(params: {
  companyId: string
  loadId?: string
  invoiceId?: string
}): Promise<{ invoiceId: string } | { error: string }> {
  if (params.invoiceId) return { invoiceId: params.invoiceId }
  if (!params.loadId) return { error: "Provide invoice_id or load_id." }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("invoices")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("load_id", params.loadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data?.id) return { error: "No invoice found for this load." }
  return { invoiceId: String(data.id) }
}

export async function execCreateLoad(
  input: Record<string, unknown>,
  _ctx: AiToolContext,
): Promise<AiToolExecuteResult<{ load_id: string; shipment_number?: string }>> {
  const customer_id = typeof input.customer_id === "string" ? input.customer_id : ""
  const pickup_location = typeof input.pickup_location === "string" ? input.pickup_location : ""
  const delivery_location = typeof input.delivery_location === "string" ? input.delivery_location : ""
  const pickup_date = typeof input.pickup_date === "string" ? input.pickup_date : null
  const delivery_date = typeof input.delivery_date === "string" ? input.delivery_date : null
  const rate_usd = typeof input.rate_usd === "number" ? input.rate_usd : undefined
  const weight_lbs = typeof input.weight_lbs === "number" ? input.weight_lbs : undefined
  const commodity = typeof input.commodity === "string" ? input.commodity : ""
  const notes = typeof input.notes === "string" ? input.notes : ""

  if (!pickup_location || !delivery_location) {
    return { ok: false, error: "pickup_location and delivery_location are required." }
  }

  const res = await createLoad({
    shipment_number: "",
    origin: pickup_location,
    destination: delivery_location,
    load_date: pickup_date,
    estimated_delivery: delivery_date,
    customer_id: customer_id || undefined,
    total_rate: rate_usd,
    rate: rate_usd,
    weight: weight_lbs !== undefined ? String(weight_lbs) : undefined,
    contents: commodity || undefined,
    notes: notes || undefined,
    status: "pending",
  })

  if (res.error || !res.data?.id) return { ok: false, error: res.error || "createLoad failed" }
  const row = res.data as { id?: string; shipment_number?: string }
  return { ok: true, data: { load_id: String(row.id), shipment_number: row.shipment_number } }
}

export async function previewCreateLoad(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const pickup = String(input.pickup_location || "")
  const drop = String(input.delivery_location || "")
  return {
    summary: `Create a new load ${pickup ? `from ${pickup}` : ""}${drop ? ` to ${drop}` : ""}${input.customer_id ? " for selected customer." : "."}`,
    affected: [{ type: "load", id: "(new)", label: "New load draft/pending" }],
  }
}

export async function execAssignDriverToLoad(
  input: Record<string, unknown>,
  _ctx: AiToolContext,
): Promise<AiToolExecuteResult<{ load_id: string; driver_id: string }>> {
  const load_id = String(input.load_id || "")
  const driver_id = String(input.driver_id || "")
  if (!load_id || !driver_id) return { ok: false, error: "load_id and driver_id required." }
  const res = await quickAssignLoad(load_id, driver_id, undefined)
  if (res.error || !res.data) return { ok: false, error: res.error || "Assignment failed" }
  return { ok: true, data: { load_id, driver_id } }
}

export async function previewAssignDriver(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const admin = createAdminClient()
  const loadId = String(input.load_id || "")
  const driverId = String(input.driver_id || "")
  const { data: load } = await admin.from("loads").select("shipment_number, origin, destination").eq("id", loadId).eq("company_id", ctx.companyId).maybeSingle()
  const { data: driver } = await admin.from("drivers").select("name").eq("id", driverId).eq("company_id", ctx.companyId).maybeSingle()
  const ln = load as { shipment_number?: string; origin?: string; destination?: string } | null
  const dn = driver as { name?: string } | null
  return {
    summary: `Assign driver ${dn?.name || driverId} to load ${ln?.shipment_number || loadId} (${ln?.origin || "?"} → ${ln?.destination || "?"}).`,
    affected: [
      { type: "load", id: loadId, label: ln?.shipment_number || loadId },
      { type: "driver", id: driverId, label: dn?.name || driverId },
    ],
  }
}

export async function execUpdateLoadStatus(
  input: Record<string, unknown>,
  _ctx: AiToolContext,
): Promise<AiToolExecuteResult<{ load_id: string; status: string }>> {
  const load_id = String(input.load_id || "")
  const new_status = String(input.new_status || "")
  if (!load_id || !new_status) return { ok: false, error: "load_id and new_status required." }
  const res = await updateLoad(load_id, { status: new_status })
  if (res.error || !res.data) return { ok: false, error: res.error || "updateLoad failed" }
  return { ok: true, data: { load_id, status: new_status } }
}

export async function previewUpdateLoadStatus(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const admin = createAdminClient()
  const loadId = String(input.load_id || "")
  const st = String(input.new_status || "")
  const { data: load } = await admin.from("loads").select("shipment_number, status").eq("id", loadId).eq("company_id", ctx.companyId).maybeSingle()
  const ln = load as { shipment_number?: string; status?: string } | null
  return {
    summary: `Change load ${ln?.shipment_number || loadId} status from "${ln?.status || "?"}" to "${st}".`,
    affected: [{ type: "load", id: loadId, label: ln?.shipment_number || loadId }],
  }
}

export async function execCopyLoad(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolExecuteResult<{ new_load_id: string }>> {
  const source_load_id = String(input.source_load_id || "")
  const new_pickup_date = typeof input.new_pickup_date === "string" ? input.new_pickup_date : null
  if (!source_load_id) return { ok: false, error: "source_load_id required." }
  const dup = await duplicateLoad(source_load_id)
  if (dup.error || !dup.data?.id) return { ok: false, error: dup.error || "duplicateLoad failed" }
  const newId = String(dup.data.id)
  if (new_pickup_date) {
    const up = await updateLoad(newId, { load_date: new_pickup_date })
    if (up.error) return { ok: false, error: up.error }
  }
  return { ok: true, data: { new_load_id: newId } }
}

export async function previewCopyLoad(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const admin = createAdminClient()
  const sid = String(input.source_load_id || "")
  const { data: load } = await admin.from("loads").select("shipment_number").eq("id", sid).eq("company_id", ctx.companyId).maybeSingle()
  const ln = load as { shipment_number?: string } | null
  return {
    summary: `Duplicate load ${ln?.shipment_number || sid} as a new draft${input.new_pickup_date ? ` with pickup date ${String(input.new_pickup_date)}.` : "."}`,
    affected: [{ type: "load", id: sid, label: ln?.shipment_number || sid }],
  }
}

export async function execSendInvoice(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolExecuteResult<{ invoice_id: string }>> {
  const loadId = typeof input.load_id === "string" ? input.load_id : undefined
  const invoiceId = typeof input.invoice_id === "string" ? input.invoice_id : undefined
  const resolved = await getInvoiceIdForLoadOrInvoice({ companyId: ctx.companyId, loadId, invoiceId })
  if ("error" in resolved) return { ok: false, error: resolved.error }
  const res = await sendInvoiceEmail(resolved.invoiceId)
  if (res.error || !res.data) return { ok: false, error: res.error || "sendInvoiceEmail failed" }
  return { ok: true, data: { invoice_id: resolved.invoiceId } }
}

export async function previewSendInvoice(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const loadId = typeof input.load_id === "string" ? input.load_id : undefined
  const invoiceId = typeof input.invoice_id === "string" ? input.invoice_id : undefined
  const resolved = await getInvoiceIdForLoadOrInvoice({ companyId: ctx.companyId, loadId, invoiceId })
  if ("error" in resolved) return blockedPreview(resolved.error)
  const admin = createAdminClient()
  const { data: inv } = await admin.from("invoices").select("invoice_number, amount").eq("id", resolved.invoiceId).maybeSingle()
  const row = inv as { invoice_number?: string; amount?: number } | null
  return {
    summary: `Email invoice ${row?.invoice_number || resolved.invoiceId} (${row?.amount != null ? `$${row.amount}` : "amount ?"}) to the customer.`,
    affected: [{ type: "invoice", id: resolved.invoiceId, label: row?.invoice_number || resolved.invoiceId }],
  }
}

export async function execMarkInvoicePaid(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolExecuteResult<{ invoice_id: string }>> {
  const invoice_id = String(input.invoice_id || "")
  const payment_date = typeof input.payment_date === "string" ? input.payment_date : new Date().toISOString().slice(0, 10)
  const payment_method = typeof input.payment_method === "string" ? input.payment_method : "other"
  if (!invoice_id) return { ok: false, error: "invoice_id required." }
  const res = await updateInvoice(invoice_id, {
    status: "paid",
    paid_date: payment_date,
    payment_method,
  })
  if (res.error || !res.data) return { ok: false, error: res.error || "updateInvoice failed" }
  return { ok: true, data: { invoice_id } }
}

export async function previewMarkInvoicePaid(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const invoice_id = String(input.invoice_id || "")
  const admin = createAdminClient()
  const { data: inv } = await admin.from("invoices").select("invoice_number, amount, status").eq("id", invoice_id).eq("company_id", ctx.companyId).maybeSingle()
  const row = inv as { invoice_number?: string; amount?: number; status?: string } | null
  return {
    summary: `Mark invoice ${row?.invoice_number || invoice_id} as paid (${String(input.payment_method || "payment")}, ${String(input.payment_date || "today")}).`,
    affected: [{ type: "invoice", id: invoice_id, label: row?.invoice_number || invoice_id }],
  }
}

export async function execSendDriverMessage(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolExecuteResult<{ driver_id: string }>> {
  const driver_id = String(input.driver_id || "")
  const message_text = String(input.message_text || "")
  if (!driver_id || !message_text) return { ok: false, error: "driver_id and message_text required." }
  const res = await sendSMSToDriver(driver_id, message_text)
  if (!res.success) return { ok: false, error: res.error || "SMS failed" }
  return { ok: true, data: { driver_id } }
}

export async function previewSendDriverMessage(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const driver_id = String(input.driver_id || "")
  const admin = createAdminClient()
  const { data: driver } = await admin.from("drivers").select("name").eq("id", driver_id).eq("company_id", ctx.companyId).maybeSingle()
  const dn = driver as { name?: string } | null
  const previewText = String(input.message_text || "").slice(0, 120)
  return {
    summary: `Send SMS to ${dn?.name || driver_id}: "${previewText}${String(input.message_text || "").length > 120 ? "…" : ""}"`,
    affected: [{ type: "driver", id: driver_id, label: dn?.name || driver_id }],
  }
}

export async function execUpdateDriverStatus(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolExecuteResult<{ driver_id: string }>> {
  const driver_id = String(input.driver_id || "")
  const status = String(input.status || "")
  const note = typeof input.note === "string" ? input.note : undefined
  if (!driver_id || !status) return { ok: false, error: "driver_id and status required." }
  const patch: Record<string, unknown> = { status }
  if (note !== undefined) patch.notes = note
  const res = await updateDriver(driver_id, patch as Parameters<typeof updateDriver>[1])
  if (res.error || !res.data) return { ok: false, error: res.error || "updateDriver failed" }
  return { ok: true, data: { driver_id } }
}

export async function previewUpdateDriverStatus(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const driver_id = String(input.driver_id || "")
  const admin = createAdminClient()
  const { data: driver } = await admin.from("drivers").select("name, status").eq("id", driver_id).eq("company_id", ctx.companyId).maybeSingle()
  const dn = driver as { name?: string; status?: string } | null
  return {
    summary: `Update driver ${dn?.name || driver_id} status from "${dn?.status || "?"}" to "${String(input.status)}".`,
    affected: [{ type: "driver", id: driver_id, label: dn?.name || driver_id }],
  }
}

export async function execCreateMaintenanceRecord(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolExecuteResult<{ maintenance_id: string }>> {
  const truck_id = typeof input.truck_id === "string" ? input.truck_id : undefined
  const service_type = String(input.service_type || "")
  const scheduled_date = String(input.scheduled_date || "")
  const notes = typeof input.notes === "string" ? input.notes : undefined
  if (!service_type || !scheduled_date) return { ok: false, error: "service_type and scheduled_date required." }
  if (!truck_id) return { ok: false, error: "truck_id required." }
  const res = await createMaintenance({ truck_id, service_type, scheduled_date, notes })
  if (res.error || !res.data?.id) return { ok: false, error: res.error || "createMaintenance failed" }
  return { ok: true, data: { maintenance_id: String(res.data.id) } }
}

export async function previewCreateMaintenance(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const truck_id = String(input.truck_id || "")
  const admin = createAdminClient()
  const { data: truck } = await admin.from("trucks").select("truck_number").eq("id", truck_id).eq("company_id", ctx.companyId).maybeSingle()
  const tn = truck as { truck_number?: string } | null
  return {
    summary: `Schedule ${String(input.service_type)} on truck ${tn?.truck_number || truck_id} for ${String(input.scheduled_date)}.`,
    affected: [
      { type: "truck", id: truck_id, label: tn?.truck_number || truck_id },
      { type: "maintenance", id: "(new)", label: "Maintenance record" },
    ],
  }
}

export async function execMarkMaintenanceComplete(input: Record<string, unknown>, _ctx: AiToolContext): Promise<AiToolExecuteResult<{ maintenance_id: string }>> {
  const maintenance_id = String(input.maintenance_id || "")
  const completion_date = typeof input.completion_date === "string" ? input.completion_date : undefined
  const cost_usd = typeof input.cost_usd === "number" ? input.cost_usd : undefined
  if (!maintenance_id) return { ok: false, error: "maintenance_id required." }
  const res = await updateMaintenanceStatus(maintenance_id, "completed", cost_usd, completion_date)
  if (res.error || !res.data) return { ok: false, error: res.error || "updateMaintenanceStatus failed" }
  return { ok: true, data: { maintenance_id } }
}

export async function previewMarkMaintenanceComplete(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const maintenance_id = String(input.maintenance_id || "")
  const admin = createAdminClient()
  const { data: row } = await admin.from("maintenance").select("service_type").eq("id", maintenance_id).eq("company_id", ctx.companyId).maybeSingle()
  const m = row as { service_type?: string } | null
  return {
    summary: `Mark maintenance ${m?.service_type || maintenance_id} completed${input.cost_usd != null ? ` (cost $${Number(input.cost_usd)})` : ""}.`,
    affected: [{ type: "maintenance", id: maintenance_id, label: m?.service_type || maintenance_id }],
  }
}

export async function execFindBestTruckForLoad(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolExecuteResult<unknown>> {
  const load_id = String(input.load_id || "")
  if (!load_id) return { ok: false, error: "load_id required." }
  const admin = createAdminClient()
  const { data: load } = await admin.from("loads").select("origin, destination, truck_id, status").eq("id", load_id).eq("company_id", ctx.companyId).maybeSingle()
  if (!load) return { ok: false, error: "Load not found." }
  const { data: trucks } = await admin
    .from("trucks")
    .select("id, truck_number, status, carrier_type")
    .eq("company_id", ctx.companyId)
    .in("status", ["available", "in_use"])
    .limit(25)
  const ranked = (trucks || []).map((t: { id: string; truck_number?: string; status?: string; carrier_type?: string }, i: number) => ({
    rank: i + 1,
    truck_id: t.id,
    truck_number: t.truck_number || t.id,
    status: t.status,
    carrier_type: t.carrier_type,
    reasoning:
      String(load.truck_id || "") === String(t.id)
        ? "Currently assigned to this load."
        : t.status === "available"
          ? "Available unit — verify trailer pairing and route constraints in Dispatch board."
          : "In use — confirm schedule gap before assigning.",
  }))
  return {
    ok: true,
    data: {
      load_id,
      route: `${load.origin} → ${load.destination}`,
      ranked_trucks: ranked.slice(0, 10),
      disclaimer: "Ranking is heuristic only; always verify permits, weight, and driver pairing in TruckMates.",
    },
  }
}

export async function previewFindBestTruck(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolPreviewResult> {
  const res = await execFindBestTruckForLoad(input, ctx)
  if (!res.ok) return blockedPreview(res.error)
  return { summary: "Analyze fleet trucks against this load for a ranked suggestion list.", affected: [{ type: "load", id: String(input.load_id), label: "Load" }] }
}

export async function execFindAvailableDrivers(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolExecuteResult<unknown>> {
  const pickup_location = String(input.pickup_location || "")
  const pickup_date = typeof input.pickup_date === "string" ? input.pickup_date : ""
  const admin = createAdminClient()
  const { data: drivers } = await admin
    .from("drivers")
    .select("id, name, status")
    .eq("company_id", ctx.companyId)
    .eq("status", "active")
    .limit(40)
  const list = (drivers || []).map((d: { id: string; name?: string }) => ({
    driver_id: d.id,
    name: d.name,
    notes: "Proximity requires ELD/address data; listing active drivers only.",
  }))
  return {
    ok: true,
    data: {
      pickup_location,
      pickup_date,
      drivers: list,
      disclaimer: "Geo routing not computed here — open Dispatch Assist for conflict-checked assignment.",
    },
  }
}

export async function previewFindDrivers(input: Record<string, unknown>): Promise<AiToolPreviewResult> {
  return {
    summary: `List active drivers potentially available near "${String(input.pickup_location)}" on ${String(input.pickup_date || "requested date")}.`,
    affected: [],
  }
}

export async function execLoadProfitability(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolExecuteResult<unknown>> {
  const load_id = String(input.load_id || "")
  if (!load_id) return { ok: false, error: "load_id required." }
  const admin = createAdminClient()
  const { data: load } = await admin
    .from("loads")
    .select("shipment_number, total_rate, rate, estimated_profit, estimated_revenue, estimated_miles, value")
    .eq("id", load_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (!load) return { ok: false, error: "Load not found." }
  return {
    ok: true,
    data: {
      shipment_number: load.shipment_number,
      revenue_proxy: Number(load.total_rate ?? load.rate ?? load.estimated_revenue ?? 0),
      estimated_profit: load.estimated_profit,
      estimated_miles: load.estimated_miles,
      cargo_value: load.value,
      note: "Costs may exclude fuel/accruals unless entered on the load.",
    },
  }
}

export async function previewLoadProfitability(input: Record<string, unknown>): Promise<AiToolPreviewResult> {
  return {
    summary: `Summarize revenue / profit fields stored on load ${String(input.load_id)}.`,
    affected: [{ type: "load", id: String(input.load_id), label: "Load" }],
  }
}

export async function execDriverPerformance(input: Record<string, unknown>, ctx: AiToolContext): Promise<AiToolExecuteResult<unknown>> {
  const driver_id = String(input.driver_id || "")
  const days_back = typeof input.days_back === "number" ? Math.min(365, Math.max(1, Math.floor(input.days_back))) : 30
  if (!driver_id) return { ok: false, error: "driver_id required." }
  const admin = createAdminClient()
  const since = new Date(Date.now() - days_back * 86400000).toISOString()
  const { data: loads } = await admin
    .from("loads")
    .select("id, status, shipment_number, load_date")
    .eq("company_id", ctx.companyId)
    .eq("driver_id", driver_id)
    .gte("created_at", since)
    .limit(200)
  const rows = loads || []
  const delivered = rows.filter((r: { status?: string }) => String(r.status || "").toLowerCase() === "delivered").length
  return {
    ok: true,
    data: {
      driver_id,
      window_days: days_back,
      loads_count: rows.length,
      delivered_count: delivered,
      recent_loads: rows.slice(0, 8).map((r: { shipment_number?: string; status?: string }) => ({
        shipment_number: r.shipment_number,
        status: r.status,
      })),
    },
  }
}

export async function previewDriverPerf(input: Record<string, unknown>): Promise<AiToolPreviewResult> {
  return {
    summary: `Driver performance snapshot for last ${String(input.days_back ?? 30)} days.`,
    affected: [{ type: "driver", id: String(input.driver_id), label: "Driver" }],
  }
}

export async function revalidateToolReferences(
  toolName: string,
  input: Record<string, unknown>,
  ctx: AiToolContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  if (toolName === "assign_driver_to_load") {
    const loadId = String(input.load_id || "")
    const driverId = String(input.driver_id || "")
    const { data: load } = await admin.from("loads").select("id").eq("id", loadId).eq("company_id", ctx.companyId).maybeSingle()
    const { data: driver } = await admin.from("drivers").select("id").eq("id", driverId).eq("company_id", ctx.companyId).maybeSingle()
    if (!load || !driver) return { ok: false, error: "Load or driver no longer valid for this company." }
  }
  if (toolName === "create_load") {
    const cid = typeof input.customer_id === "string" ? input.customer_id : ""
    if (cid) {
      const { data: c } = await admin.from("customers").select("id").eq("id", cid).eq("company_id", ctx.companyId).maybeSingle()
      if (!c) return { ok: false, error: "Customer no longer exists." }
    }
  }
  if (toolName === "mark_invoice_paid" || toolName === "send_invoice") {
    const invoiceId = typeof input.invoice_id === "string" ? input.invoice_id : ""
    const loadId = typeof input.load_id === "string" ? input.load_id : ""
    if (invoiceId) {
      const { data: inv } = await admin.from("invoices").select("id").eq("id", invoiceId).eq("company_id", ctx.companyId).maybeSingle()
      if (!inv) return { ok: false, error: "Invoice no longer exists." }
    }
    if (!invoiceId && loadId) {
      const r = await getInvoiceIdForLoadOrInvoice({ companyId: ctx.companyId, loadId })
      if ("error" in r) return { ok: false, error: r.error }
    }
  }
  if (toolName === "update_load_status" || toolName === "copy_load") {
    const loadId = String((toolName === "copy_load" ? input.source_load_id : input.load_id) || "")
    if (!loadId) return { ok: false, error: "Load id missing." }
    const { data: load } = await admin.from("loads").select("id").eq("id", loadId).eq("company_id", ctx.companyId).maybeSingle()
    if (!load) return { ok: false, error: "Load no longer exists." }
  }
  if (toolName === "send_driver_message" || toolName === "update_driver_status") {
    const driverId = String(input.driver_id || "")
    if (!driverId) return { ok: false, error: "Driver id missing." }
    const { data: driver } = await admin.from("drivers").select("id").eq("id", driverId).eq("company_id", ctx.companyId).maybeSingle()
    if (!driver) return { ok: false, error: "Driver no longer exists." }
  }
  if (toolName === "create_maintenance_record") {
    const truckId = String(input.truck_id || "")
    if (!truckId) return { ok: false, error: "Truck id missing." }
    const { data: truck } = await admin.from("trucks").select("id").eq("id", truckId).eq("company_id", ctx.companyId).maybeSingle()
    if (!truck) return { ok: false, error: "Truck no longer exists." }
  }
  if (toolName === "mark_maintenance_complete") {
    const mid = String(input.maintenance_id || "")
    if (!mid) return { ok: false, error: "Maintenance id missing." }
    const { data: row } = await admin.from("maintenance").select("id").eq("id", mid).eq("company_id", ctx.companyId).maybeSingle()
    if (!row) return { ok: false, error: "Maintenance record no longer exists." }
  }
  return { ok: true }
}
