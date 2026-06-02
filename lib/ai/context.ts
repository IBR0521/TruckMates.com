import { createAdminClient } from "@/lib/supabase/admin"
import { computeDailyRemainingFromEldLogs, type EldLogLike } from "@/lib/hos/compute-daily-remaining"

type Row = Record<string, unknown>

function toIsoDate(value: unknown): string | null {
  if (!value) return null
  const text = String(value)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatHours(value: number): string {
  return `${Math.max(0, value).toFixed(2)}h`
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function statusBreakdown(rows: Row[], key = "status"): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const status = String(row[key] || "unknown").toLowerCase()
    counts[status] = (counts[status] || 0) + 1
  }
  return counts
}

function renderBreakdown(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return "none"
  return entries.map(([key, value]) => `${key}:${value}`).join(", ")
}

function safeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function parseEndorsements(value: unknown): string {
  const text = String(value || "").trim()
  return text || "unknown"
}

/**
 * Prompt-injection boundary for free-text values that originate from user/customer input
 * (load notes, driver notes, customer names/notes, address-book notes, communication thread
 * bodies, etc.). The value is wrapped in an explicit, parseable delimiter so the model treats it
 * as DATA, never instructions. Any attempt to forge or close the boundary from inside the value is
 * neutralized so the tags can never be broken out of.
 */
export function wrapUntrusted(label: string, value: string): string {
  const source = String(label || "field").replace(/[^a-zA-Z0-9_]/g, "_")
  const escaped = String(value ?? "")
    .replace(/<\s*\/\s*untrusted_data\s*>/gi, "[/untrusted_data]")
    .replace(/<\s*untrusted_data/gi, "[untrusted_data")
  return `<untrusted_data source="${source}">${escaped}</untrusted_data>`
}

/** Minimum tally before a recurring approve/reject pattern is surfaced to the model (avoids one-offs). */
const PREFERENCE_MIN_COUNT = 2
/** Cap how many learned patterns we inject so the context block stays small. */
const PREFERENCE_MAX_PATTERNS = 8

/**
 * Canonical entity id (e.g. "driver:abc", "load:xyz") from a tool input / action payload, used to
 * scope a preference to a specific entity. Returns "" when the action is not entity-specific.
 */
export function extractPreferenceEntityId(input: Record<string, unknown> | null | undefined): string {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input : {}
  const candidates: Array<{ type: string; keys: string[] }> = [
    { type: "driver", keys: ["driver_id", "driverId"] },
    { type: "load", keys: ["load_id", "loadId"] },
    { type: "truck", keys: ["truck_id", "truckId"] },
  ]
  for (const { type, keys } of candidates) {
    for (const key of keys) {
      const value = String((record as Record<string, unknown>)[key] ?? "").trim()
      if (value) return `${type}:${value}`
    }
  }
  return ""
}

/**
 * Best-effort, atomic upsert-increment of a company's approve/reject tally for a tool (+ optional
 * entity). Never throws — preference accumulation must never block the approve/reject flow.
 */
export async function recordActionPreference(params: {
  companyId: string
  toolName: string
  entityId?: string | null
  outcome: "approved" | "rejected"
}): Promise<void> {
  try {
    const companyId = String(params.companyId || "").trim()
    const toolName = String(params.toolName || "").trim()
    if (!companyId || !toolName) return
    if (params.outcome !== "approved" && params.outcome !== "rejected") return

    const supabase = createAdminClient()
    await supabase.rpc("increment_ai_action_preference", {
      p_company_id: companyId,
      p_tool_name: toolName,
      p_entity_id: String(params.entityId ?? "").trim(),
      p_outcome: params.outcome,
    })
  } catch {
    // Best-effort only.
  }
}

/**
 * Short context block of the company's most recurring approve/reject patterns, so the assistant can
 * adapt recommendations to learned behavior. Returns "" when there are no meaningful patterns or on
 * any query error (matches the try/catch-returns-empty pattern used elsewhere in this file).
 */
export async function getPreferenceContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("ai_action_preferences")
      .select("tool_name, entity_id, outcome, count")
      .eq("company_id", companyId)
      .gte("count", PREFERENCE_MIN_COUNT)
      .order("count", { ascending: false })
      .limit(PREFERENCE_MAX_PATTERNS)

    if (error || !data || data.length === 0) return ""

    const lines = (data as Row[]).map((row) => {
      const tool = String(row.tool_name || "").trim()
      const rawEntity = String(row.entity_id || "").trim()
      const outcome = String(row.outcome || "").trim()
      const count = Math.max(0, Math.round(Number(row.count) || 0))
      const times = `${count} time${count === 1 ? "" : "s"}`

      // entity_id is stored as "type:id"; render as "type id" for readability.
      const target = rawEntity ? ` for ${rawEntity.replace(":", " ")}` : ""

      if (outcome === "rejected") {
        return `- This company has rejected ${tool}${target} ${times} — recommend but do NOT auto-execute; ask for explicit confirmation.`
      }
      return `- This company has approved ${tool}${target} ${times} — this is an accepted pattern for them.`
    })

    return ["Learned action preferences (recurring approve/reject patterns for this company):", ...lines].join("\n")
  } catch {
    return ""
  }
}

/** Allowed memory kinds for the per-company AI memory store. */
export type CompanyMemoryKind = "alias" | "recurring_question" | "note"
const COMPANY_MEMORY_KINDS: CompanyMemoryKind[] = ["alias", "recurring_question", "note"]

/** Caps that keep the injected memory block small and cheap. */
const MEMORY_MAX_PER_KIND = 4
const MEMORY_MAX_TOTAL = 10
const MEMORY_MAX_BLOCK_CHARS = 1200
const MEMORY_KEY_MAX = 120
const MEMORY_VALUE_MAX = 240

/**
 * Best-effort atomic upsert-increment of a distilled per-company memory entry. Re-distilling the
 * same (kind, key) bumps its hit count and refreshes the value. Never throws (memory is a hint store,
 * not a source of truth) — used by the nightly distillation cron.
 */
export async function upsertCompanyMemory(params: {
  companyId: string
  kind: CompanyMemoryKind
  key: string
  value: string
}): Promise<void> {
  try {
    const companyId = String(params.companyId || "").trim()
    const key = String(params.key || "").trim().slice(0, MEMORY_KEY_MAX)
    const value = String(params.value || "").trim().slice(0, MEMORY_VALUE_MAX)
    if (!companyId || !key || !value) return
    if (!COMPANY_MEMORY_KINDS.includes(params.kind)) return

    const supabase = createAdminClient()
    await supabase.rpc("upsert_ai_company_memory", {
      p_company_id: companyId,
      p_kind: params.kind,
      p_key: key,
      p_value: value,
    })
  } catch {
    // Best-effort only.
  }
}

const MEMORY_KIND_LABELS: Record<CompanyMemoryKind, string> = {
  alias: "Aliases this company uses",
  recurring_question: "Frequently asked",
  note: "Preferences / notes",
}

/**
 * Short, capped block of the company's distilled memory (aliases, recurring questions, stable
 * preferences) ranked by hits. Treated as hints to interpret phrasing — not authoritative data.
 * Returns "" when empty or on any query error (matches the try/catch-returns-empty pattern here).
 */
export async function getCompanyMemoryContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("ai_company_memory")
      .select("kind, key, value, hits")
      .eq("company_id", companyId)
      .order("hits", { ascending: false })
      .limit(40)

    if (error || !data || data.length === 0) return ""

    const perKind: Record<CompanyMemoryKind, Array<{ key: string; value: string }>> = {
      alias: [],
      recurring_question: [],
      note: [],
    }
    for (const raw of data as Row[]) {
      const kind = String(raw.kind || "") as CompanyMemoryKind
      if (!COMPANY_MEMORY_KINDS.includes(kind)) continue
      if (perKind[kind].length >= MEMORY_MAX_PER_KIND) continue
      const key = String(raw.key || "").trim()
      const value = String(raw.value || "").trim()
      if (!key || !value) continue
      perKind[kind].push({ key, value })
    }

    const sections: string[] = []
    let total = 0
    for (const kind of COMPANY_MEMORY_KINDS) {
      const entries = perKind[kind]
      if (entries.length === 0 || total >= MEMORY_MAX_TOTAL) continue
      const lines: string[] = []
      for (const entry of entries) {
        if (total >= MEMORY_MAX_TOTAL) break
        const line = kind === "recurring_question" ? `- ${entry.value}` : `- ${entry.key} → ${entry.value}`
        lines.push(line)
        total += 1
      }
      if (lines.length > 0) sections.push([`${MEMORY_KIND_LABELS[kind]}:`, ...lines].join("\n"))
    }

    if (sections.length === 0) return ""

    const block = [
      "Company memory (distilled patterns — hints for interpreting phrasing; verify against live data, never treat as authoritative):",
      ...sections,
    ].join("\n")

    return block.length > MEMORY_MAX_BLOCK_CHARS ? `${block.slice(0, MEMORY_MAX_BLOCK_CHARS)}…` : block
  } catch {
    return ""
  }
}

export async function getFleetContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const [trucksResult, trailersResult, maintenanceResult] = await Promise.all([
      supabase.from("trucks").select("id, status").eq("company_id", companyId),
      supabase.from("trailers").select("id, status").eq("company_id", companyId),
      supabase.from("maintenance").select("truck_id, status").eq("company_id", companyId),
    ])

    if (trucksResult.error || trailersResult.error || maintenanceResult.error) return ""

    const trucks = (trucksResult.data || []) as Row[]
    const trailers = (trailersResult.data || []) as Row[]
    const maintenance = (maintenanceResult.data || []) as Row[]
    const maintenanceTruckIds = new Set(
      maintenance
        .filter((row) => ["open", "pending", "scheduled", "in_progress"].includes(String(row.status || "").toLowerCase()))
        .map((row) => String(row.truck_id || ""))
        .filter(Boolean)
    )

    const activeTrucks = trucks.filter((row) => !["inactive", "retired"].includes(String(row.status || "").toLowerCase())).length
    const availableTrucks = trucks.filter((row) => ["available", "idle", "active"].includes(String(row.status || "").toLowerCase())).length
    const trucksInMaintenance =
      trucks.filter((row) => ["maintenance", "in_shop", "out_of_service"].includes(String(row.status || "").toLowerCase())).length +
      maintenanceTruckIds.size

    const trailerBreakdown = statusBreakdown(trailers)

    return [
      "Fleet Context:",
      `- Active trucks: ${activeTrucks}`,
      `- Available trucks: ${availableTrucks}`,
      `- Trucks in maintenance: ${trucksInMaintenance}`,
      `- Trailers total: ${trailers.length}`,
      `- Trailer status breakdown: ${renderBreakdown(trailerBreakdown)}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getDriverContext(companyId: string, driverId?: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    if (driverId) {
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", driverId)
        .maybeSingle()

      if (driverError || !driver) return ""

      const normalizedDriverId = String(driver.id)
      const linkedUserId = String((driver as Row).user_id || "").trim()
      const logIds = linkedUserId ? [normalizedDriverId, linkedUserId] : [normalizedDriverId]
      const eightDaysAgo = addDays(startOfUtcDay(), -8).toISOString()
      const todayYmd = new Date().toISOString().slice(0, 10)

      const [logsResult, latestLogResult, eventsResult, truckResult] = await Promise.all([
        supabase
          .from("eld_logs")
          .select("driver_id, log_type, duration_minutes, start_time, end_time, log_date")
          .in("driver_id", logIds)
          .gte("start_time", eightDaysAgo)
          .order("start_time", { ascending: false })
          .limit(2000),
        supabase
          .from("eld_logs")
          .select("log_type, start_time")
          .in("driver_id", logIds)
          .order("start_time", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("eld_events")
          .select("id")
          .eq("company_id", companyId)
          .eq("event_type", "hos_violation")
          .eq("resolved", false)
          .gte("event_time", addDays(startOfUtcDay(), -90).toISOString())
          .or(`driver_id.eq.${normalizedDriverId},driver_id.eq.${linkedUserId || "__none__"}`),
        (driver as Row).truck_id
          ? supabase
              .from("trucks")
              .select("current_location")
              .eq("company_id", companyId)
              .eq("id", String((driver as Row).truck_id))
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (logsResult.error || latestLogResult.error || eventsResult.error) return ""

      const logs = (logsResult.data || []) as EldLogLike[]
      const todayLogs = logs.filter((log) => {
        const logDate = String((log as Row).log_date || "")
        if (logDate === todayYmd) return true
        const start = String((log as Row).start_time || "")
        return start.slice(0, 10) === todayYmd
      })
      const hos = computeDailyRemainingFromEldLogs(todayLogs, Date.now(), logs)
      const location =
        String((driver as Row).current_location || "").trim() ||
        String(((truckResult as { data?: Row | null })?.data as Row | null)?.current_location || "").trim() ||
        "unknown"

      const driverNameText = String((driver as Row).name || "").trim()

      return [
        "Driver Context:",
        `- Name: ${driverNameText ? wrapUntrusted("driver_name", driverNameText) : "unknown"}`,
        `- CDL class: ${String((driver as Row).license_type || "unknown")}`,
        `- Endorsements: ${parseEndorsements((driver as Row).license_endorsements)}`,
        `- Remaining HOS drive hours: ${formatHours(hos.remainingDriving)}`,
        `- Remaining HOS on-duty hours: ${formatHours(hos.remainingOnDuty)}`,
        `- Current duty status: ${String(((latestLogResult.data as Row | null)?.log_type as string) || "off_duty")}`,
        `- Current location (last known): ${location}`,
        `- Violations in last 90 days: ${(eventsResult.data || []).length}`,
      ].join("\n")
    }

    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, status")
      .eq("company_id", companyId)

    if (driversError) return ""

    const driverRows = (drivers || []) as Row[]
    const driverIds = driverRows.map((row) => String(row.id)).filter(Boolean)
    const todayStart = startOfUtcDay().toISOString()

    const [latestLogsResult, violationsTodayResult] = await Promise.all([
      driverIds.length > 0
        ? supabase
            .from("eld_logs")
            .select("driver_id, log_type, start_time")
            .in("driver_id", driverIds)
            .gte("start_time", addDays(startOfUtcDay(), -1).toISOString())
            .order("start_time", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("eld_events")
        .select("id")
        .eq("company_id", companyId)
        .eq("event_type", "hos_violation")
        .gte("event_time", todayStart),
    ])

    if (latestLogsResult.error || violationsTodayResult.error) return ""

    const latestByDriver = new Map<string, string>()
    for (const log of (latestLogsResult.data || []) as Row[]) {
      const id = String(log.driver_id || "")
      if (!id || latestByDriver.has(id)) continue
      latestByDriver.set(id, String(log.log_type || "off_duty"))
    }

    let onDuty = 0
    for (const status of latestByDriver.values()) {
      if (status === "driving" || status === "on_duty") onDuty += 1
    }
    const available = Math.max(0, driverRows.length - onDuty)

    return [
      "Driver Context:",
      `- Total drivers: ${driverRows.length}`,
      `- On-duty drivers: ${onDuty}`,
      `- Available drivers: ${available}`,
      `- Drivers with HOS violations today: ${(violationsTodayResult.data || []).length}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getLoadContext(companyId: string, loadId?: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    if (loadId) {
      const { data: load, error: loadError } = await supabase
        .from("loads")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", loadId)
        .maybeSingle()

      if (loadError || !load) return ""

      const loadRow = load as Row

      const [driverResult, truckResult, customerResult] = await Promise.all([
        loadRow.driver_id
          ? supabase.from("drivers").select("name").eq("company_id", companyId).eq("id", String(loadRow.driver_id)).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        loadRow.truck_id
          ? supabase.from("trucks").select("truck_number").eq("company_id", companyId).eq("id", String(loadRow.truck_id)).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        loadRow.customer_id
          ? supabase.from("customers").select("name").eq("company_id", companyId).eq("id", String(loadRow.customer_id)).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const eta =
        String(loadRow.current_eta || "").trim() ||
        String(loadRow.eta || "").trim() ||
        String(loadRow.estimated_delivery || "").trim() ||
        "unknown"

      const detention = safeNumber(loadRow.detention_amount || loadRow.detention_total || 0)
      const accessorials = safeNumber(loadRow.accessorial_total || loadRow.accessorial_amount || 0)
      const rate = safeNumber(loadRow.rate ?? loadRow.value ?? 0)

      const originText = String(loadRow.origin || "").trim()
      const destinationText = String(loadRow.destination || "").trim()
      const customerText = String((customerResult.data as Row | null)?.name || loadRow.customer_name || "").trim()
      const assignedDriverText = String((driverResult.data as Row | null)?.name || "").trim()

      return [
        "Load Context:",
        `- Origin: ${originText ? wrapUntrusted("load_origin", originText) : "unknown"}`,
        `- Destination: ${destinationText ? wrapUntrusted("load_destination", destinationText) : "unknown"}`,
        `- Customer: ${customerText ? wrapUntrusted("customer_name", customerText) : "unknown"}`,
        `- Rate: ${formatMoney(rate)}`,
        `- Status: ${String(loadRow.status || "unknown")}`,
        `- Assigned driver: ${assignedDriverText ? wrapUntrusted("driver_name", assignedDriverText) : "unassigned"}`,
        `- Assigned truck: ${String((truckResult.data as Row | null)?.truck_number || "unassigned")}`,
        `- Pickup time: ${String(loadRow.pickup_time || loadRow.load_date || "unknown")}`,
        `- Delivery time: ${String(loadRow.delivery_time || loadRow.estimated_delivery || "unknown")}`,
        `- Current ETA: ${eta}`,
        `- Detention: ${formatMoney(detention)}`,
        `- Accessorials: ${formatMoney(accessorials)}`,
      ].join("\n")
    }

    const { data: loads, error: loadsError } = await supabase
      .from("loads")
      .select("id, status, estimated_delivery, delivery_time")
      .eq("company_id", companyId)

    if (loadsError) return ""

    const now = new Date()
    const todayYmd = now.toISOString().slice(0, 10)
    const deliveredStatuses = new Set(["delivered", "invoiced", "paid", "cancelled"])
    const rows = (loads || []) as Row[]
    const byStatus = statusBreakdown(rows)

    let dueToday = 0
    let overdue = 0

    for (const load of rows) {
      const eta = String(load.delivery_time || load.estimated_delivery || "")
      if (!eta) continue
      const etaDate = toIsoDate(eta)
      if (!etaDate) continue
      const etaYmd = etaDate.slice(0, 10)
      const status = String(load.status || "").toLowerCase()
      if (etaYmd === todayYmd) dueToday += 1
      if (etaDate < now.toISOString() && !deliveredStatuses.has(status)) overdue += 1
    }

    return [
      "Load Context:",
      `- Load status breakdown: ${renderBreakdown(byStatus)}`,
      `- Loads due today: ${dueToday}`,
      `- Overdue loads: ${overdue}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getFinancialContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("amount, status, due_date, issue_date, customer_name")
        .eq("company_id", companyId),
      supabase
        .from("expenses")
        .select("amount, date")
        .eq("company_id", companyId),
    ])

    if (invoicesResult.error || expensesResult.error) return ""

    const invoices = (invoicesResult.data || []) as Row[]
    const expenses = (expensesResult.data || []) as Row[]

    const paidStatuses = new Set(["paid"])
    const openStatuses = new Set(["pending", "sent", "overdue", "invoiced", "approved"])
    const now = new Date()
    const todayIso = now.toISOString()
    const monthStart = startOfUtcMonth(now)
    const previousMonthStart = startOfUtcMonth(addDays(monthStart, -1))

    let arOutstanding = 0
    const agingBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }
    const overdueByCustomer = new Map<string, number>()
    let revenueThisMonth = 0
    let revenueLastMonth = 0

    for (const invoice of invoices) {
      const amount = safeNumber(invoice.amount)
      const status = String(invoice.status || "").toLowerCase()
      const issueDate = toIsoDate(invoice.issue_date)
      const dueDate = toIsoDate(invoice.due_date)
      const customer = String(invoice.customer_name || "unknown")

      if (!paidStatuses.has(status) && openStatuses.has(status)) {
        arOutstanding += amount
      }

      if (!paidStatuses.has(status) && dueDate) {
        const daysPastDue = Math.floor((new Date(todayIso).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
        if (daysPastDue <= 30) agingBuckets["0-30"] += amount
        else if (daysPastDue <= 60) agingBuckets["31-60"] += amount
        else if (daysPastDue <= 90) agingBuckets["61-90"] += amount
        else agingBuckets["90+"] += amount

        if (daysPastDue > 0) {
          overdueByCustomer.set(customer, (overdueByCustomer.get(customer) || 0) + amount)
        }
      }

      if (issueDate) {
        const issue = new Date(issueDate)
        if (issue >= monthStart) revenueThisMonth += amount
        else if (issue >= previousMonthStart && issue < monthStart) revenueLastMonth += amount
      }
    }

    let currentMonthExpenseTotal = 0
    for (const expense of expenses) {
      const dateIso = toIsoDate(expense.date)
      if (!dateIso) continue
      if (new Date(dateIso) >= monthStart) {
        currentMonthExpenseTotal += safeNumber(expense.amount)
      }
    }

    const topOverdue = [...overdueByCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, amount]) => `${name === "unknown" ? "unknown" : wrapUntrusted("customer_name", name)}:${formatMoney(amount)}`)
      .join(", ") || "none"

    return [
      "Financial Context:",
      `- Total AR outstanding: ${formatMoney(arOutstanding)}`,
      `- AR aging 0-30: ${formatMoney(agingBuckets["0-30"])}`,
      `- AR aging 31-60: ${formatMoney(agingBuckets["31-60"])}`,
      `- AR aging 61-90: ${formatMoney(agingBuckets["61-90"])}`,
      `- AR aging 90+: ${formatMoney(agingBuckets["90+"])}`,
      `- Revenue this month: ${formatMoney(revenueThisMonth)}`,
      `- Revenue last month: ${formatMoney(revenueLastMonth)}`,
      `- Top 3 overdue customers: ${topOverdue}`,
      `- Current month expense total: ${formatMoney(currentMonthExpenseTotal)}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getComplianceContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const today = startOfUtcDay()
    const in30Days = addDays(today, 30)

    const [documentsResult, driversResult, csaResult, registrationsResult] = await Promise.all([
      supabase
        .from("documents")
        .select("type, expiry_date, truck_id")
        .eq("company_id", companyId)
        .not("expiry_date", "is", null),
      supabase
        .from("drivers")
        .select("name, license_expiry")
        .eq("company_id", companyId),
      supabase
        .from("csa_scores")
        .select("snapshot_month, unsafe_driving, hours_of_service, driver_fitness, controlled_substances, vehicle_maintenance, hazardous_materials, crash_indicator")
        .eq("company_id", companyId)
        .order("snapshot_month", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("compliance_registrations")
        .select("type, expiry_date, status")
        .eq("company_id", companyId)
        .in("type", ["ucr", "irp", "mcs150"]),
    ])

    if (documentsResult.error || driversResult.error || registrationsResult.error) return ""

    const documents = (documentsResult.data || []) as Row[]
    const drivers = (driversResult.data || []) as Row[]
    const registrations = (registrationsResult.data || []) as Row[]

    const expiringDocCounts: Record<string, number> = {}
    const overdueInspectionTruckIds = new Set<string>()
    for (const doc of documents) {
      const type = String(doc.type || "unknown").toLowerCase()
      const expiryIso = toIsoDate(doc.expiry_date)
      if (!expiryIso) continue

      const expiry = new Date(expiryIso)
      if (expiry >= today && expiry <= in30Days) {
        expiringDocCounts[type] = (expiringDocCounts[type] || 0) + 1
      }

      if (type.includes("inspection") && expiry < today && doc.truck_id) {
        overdueInspectionTruckIds.add(String(doc.truck_id))
      }
    }

    let driversWithComplianceIssues = 0
    for (const driver of drivers) {
      const expiryIso = toIsoDate(driver.license_expiry)
      if (!expiryIso) continue
      const expiry = new Date(expiryIso)
      if (expiry <= in30Days) driversWithComplianceIssues += 1
    }

    const latestCsa = (csaResult.data || null) as Row | null
    const latestMonth = String(latestCsa?.snapshot_month || "not_available")
    const csaKeys = [
      "unsafe_driving",
      "hours_of_service",
      "driver_fitness",
      "controlled_substances",
      "vehicle_maintenance",
      "hazardous_materials",
      "crash_indicator",
    ]
    const above55 = csaKeys
      .map((key) => ({ key, value: safeNumber(latestCsa?.[key]) }))
      .filter((entry) => entry.value > 55)
      .map((entry) => `${entry.key}:${entry.value.toFixed(1)}%`)
      .join(", ") || "none"

    const upcomingRenewals = registrations
      .filter((reg) => {
        const expiryIso = toIsoDate(reg.expiry_date)
        if (!expiryIso) return false
        const expiry = new Date(expiryIso)
        const status = String(reg.status || "active").toLowerCase()
        return status !== "inactive" && expiry >= today && expiry <= in30Days
      })
      .map((reg) => String(reg.type || "unknown"))
      .reduce<Record<string, number>>((acc, type) => {
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

    return [
      "Compliance Context:",
      `- Documents expiring in next 30 days: ${renderBreakdown(expiringDocCounts)}`,
      `- Drivers with compliance issues: ${driversWithComplianceIssues}`,
      `- Trucks with overdue inspections: ${overdueInspectionTruckIds.size}`,
      `- CSA latest month: ${latestMonth}`,
      `- CSA categories above 55%: ${above55}`,
      `- Upcoming registration renewals (UCR/IRP/MCS-150): ${renderBreakdown(upcomingRenewals)}`,
    ].join("\n")
  } catch {
    return ""
  }
}

const ROSTER_LIMIT = 25
const ROSTER_DELIVERED_STATUSES = new Set(["delivered", "invoiced", "paid", "cancelled"])
const ROSTER_OPEN_MAINTENANCE_STATUSES = ["open", "pending", "scheduled", "in_progress"]
const ROSTER_MAINTENANCE_TRUCK_STATUSES = ["maintenance", "in_shop", "repair", "out_of_service"]

export async function getDriverRosterContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    const { data: drivers, error: driversError, count } = await supabase
      .from("drivers")
      .select("id, user_id, name, license_type, license_endorsements, current_location, truck_id, status", {
        count: "exact",
      })
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(ROSTER_LIMIT)

    if (driversError) return ""

    const driverRows = (drivers || []) as Row[]
    if (driverRows.length === 0) {
      return ["Driver Roster (active, entity-level):", "- none"].join("\n")
    }

    const totalActive = typeof count === "number" ? count : driverRows.length
    const omitted = Math.max(0, totalActive - driverRows.length)

    const logIdToDriver = new Map<string, string>()
    const driverIds: string[] = []
    const truckIds = new Set<string>()
    for (const driver of driverRows) {
      const id = String(driver.id || "")
      if (!id) continue
      driverIds.push(id)
      logIdToDriver.set(id, id)
      const userId = String(driver.user_id || "").trim()
      if (userId) logIdToDriver.set(userId, id)
      const truckId = String(driver.truck_id || "").trim()
      if (truckId) truckIds.add(truckId)
    }

    const logIds = Array.from(logIdToDriver.keys())
    const eightDaysAgo = addDays(startOfUtcDay(), -8).toISOString()
    const todayYmd = new Date().toISOString().slice(0, 10)
    const nowMs = Date.now()

    const [logsResult, latestLogsResult, trucksResult, loadsResult] = await Promise.all([
      logIds.length > 0
        ? supabase
            .from("eld_logs")
            .select("driver_id, log_type, duration_minutes, start_time, end_time, log_date")
            .in("driver_id", logIds)
            .gte("start_time", eightDaysAgo)
            .order("start_time", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [], error: null }),
      logIds.length > 0
        ? supabase
            .from("eld_logs")
            .select("driver_id, log_type, start_time")
            .in("driver_id", logIds)
            .order("start_time", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [], error: null }),
      truckIds.size > 0
        ? supabase
            .from("trucks")
            .select("id, current_location")
            .eq("company_id", companyId)
            .in("id", Array.from(truckIds))
        : Promise.resolve({ data: [], error: null }),
      driverIds.length > 0
        ? supabase
            .from("loads")
            .select("id, status, driver_id")
            .eq("company_id", companyId)
            .in("driver_id", driverIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (logsResult.error || latestLogsResult.error || trucksResult.error || loadsResult.error) return ""

    const logsByDriver = new Map<string, EldLogLike[]>()
    for (const log of (logsResult.data || []) as Row[]) {
      const driverId = logIdToDriver.get(String(log.driver_id || ""))
      if (!driverId) continue
      const bucket = logsByDriver.get(driverId)
      if (bucket) bucket.push(log as unknown as EldLogLike)
      else logsByDriver.set(driverId, [log as unknown as EldLogLike])
    }

    const latestStatusByDriver = new Map<string, string>()
    for (const log of (latestLogsResult.data || []) as Row[]) {
      const driverId = logIdToDriver.get(String(log.driver_id || ""))
      if (!driverId || latestStatusByDriver.has(driverId)) continue
      latestStatusByDriver.set(driverId, String(log.log_type || "off_duty"))
    }

    const truckLocationById = new Map<string, string>()
    for (const truck of (trucksResult.data || []) as Row[]) {
      truckLocationById.set(String(truck.id), String(truck.current_location || "").trim())
    }

    const loadByDriver = new Map<string, Row>()
    for (const load of (loadsResult.data || []) as Row[]) {
      const driverId = String(load.driver_id || "")
      if (!driverId) continue
      if (ROSTER_DELIVERED_STATUSES.has(String(load.status || "").toLowerCase())) continue
      if (!loadByDriver.has(driverId)) loadByDriver.set(driverId, load)
    }

    const lines = driverRows.map((driver) => {
      const id = String(driver.id || "")
      const allLogs = logsByDriver.get(id) || []
      const todayLogs = allLogs.filter((log) => {
        const logDate = String((log as Row).log_date || "")
        if (logDate === todayYmd) return true
        const start = String((log as Row).start_time || "")
        return start.slice(0, 10) === todayYmd
      })
      const hos = computeDailyRemainingFromEldLogs(todayLogs, nowMs, allLogs)
      const location =
        String(driver.current_location || "").trim() ||
        truckLocationById.get(String(driver.truck_id || "")) ||
        "unknown"
      const load = loadByDriver.get(id)
      const loadPart = load
        ? `load=${String(load.id)} load_status=${String(load.status || "unknown")}`
        : "load=none load_status=none"
      const rosterDriverName = String(driver.name || "").trim()

      return [
        `- id=${id}`,
        `name=${rosterDriverName ? wrapUntrusted("driver_name", rosterDriverName) : "unknown"}`,
        `cdl=${String(driver.license_type || "unknown")}`,
        `endorsements=${parseEndorsements(driver.license_endorsements)}`,
        `hos_drive_left=${formatHours(hos.remainingDriving)}`,
        `hos_onduty_left=${formatHours(hos.remainingOnDuty)}`,
        `duty=${latestStatusByDriver.get(id) || "off_duty"}`,
        `location="${location}"`,
        loadPart,
      ].join(" | ")
    })

    if (omitted > 0) {
      lines.push(`- (${omitted} more active driver${omitted === 1 ? "" : "s"} omitted to limit token cost)`)
    }

    return ["Driver Roster (active, entity-level):", ...lines].join("\n")
  } catch {
    return ""
  }
}

export async function getTruckRosterContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    const { data: trucks, error: trucksError, count } = await supabase
      .from("trucks")
      .select("id, truck_number, status, current_location, mileage, current_driver_id", { count: "exact" })
      .eq("company_id", companyId)
      .order("truck_number", { ascending: true })
      .limit(ROSTER_LIMIT)

    if (trucksError) return ""

    const truckRows = (trucks || []) as Row[]
    if (truckRows.length === 0) {
      return ["Truck Roster (entity-level):", "- none"].join("\n")
    }

    const total = typeof count === "number" ? count : truckRows.length
    const omitted = Math.max(0, total - truckRows.length)

    const truckIds = truckRows.map((truck) => String(truck.id)).filter(Boolean)
    const driverIds = new Set<string>()
    for (const truck of truckRows) {
      const driverId = String(truck.current_driver_id || "").trim()
      if (driverId) driverIds.add(driverId)
    }

    const [maintenanceResult, driversResult] = await Promise.all([
      truckIds.length > 0
        ? supabase.from("maintenance").select("truck_id, status").eq("company_id", companyId).in("truck_id", truckIds)
        : Promise.resolve({ data: [], error: null }),
      driverIds.size > 0
        ? supabase.from("drivers").select("id, name").eq("company_id", companyId).in("id", Array.from(driverIds))
        : Promise.resolve({ data: [], error: null }),
    ])

    if (maintenanceResult.error || driversResult.error) return ""

    const openMaintenanceTruckIds = new Set(
      ((maintenanceResult.data || []) as Row[])
        .filter((row) => ROSTER_OPEN_MAINTENANCE_STATUSES.includes(String(row.status || "").toLowerCase()))
        .map((row) => String(row.truck_id || ""))
        .filter(Boolean)
    )

    const driverNameById = new Map<string, string>()
    for (const driver of (driversResult.data || []) as Row[]) {
      driverNameById.set(String(driver.id), String(driver.name || "unknown"))
    }

    const lines = truckRows.map((truck) => {
      const id = String(truck.id)
      const inMaintenance =
        ROSTER_MAINTENANCE_TRUCK_STATUSES.includes(String(truck.status || "").toLowerCase()) ||
        openMaintenanceTruckIds.has(id)
      const driverId = String(truck.current_driver_id || "").trim()
      const resolvedDriverName = driverId ? String(driverNameById.get(driverId) || "").trim() : ""
      const driverDisplay = driverId
        ? resolvedDriverName
          ? wrapUntrusted("driver_name", resolvedDriverName)
          : "unknown"
        : "unassigned"

      return [
        `- id=${id}`,
        `truck_number=${String(truck.truck_number || "unknown")}`,
        `status=${String(truck.status || "unknown")}`,
        `location="${String(truck.current_location || "").trim() || "unknown"}"`,
        `mileage=${String(truck.mileage ?? "unknown")}`,
        `in_maintenance=${inMaintenance ? "yes" : "no"}`,
        `driver=${driverDisplay}`,
      ].join(" | ")
    })

    if (omitted > 0) {
      lines.push(`- (${omitted} more truck${omitted === 1 ? "" : "s"} omitted to limit token cost)`)
    }

    return ["Truck Roster (entity-level):", ...lines].join("\n")
  } catch {
    return ""
  }
}

export async function getMaintenanceContext(companyId: string, truckId?: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const today = startOfUtcDay()

    if (truckId) {
      const [truckResult, maintenanceResult, workOrdersResult, dvirResult] = await Promise.all([
        supabase
          .from("trucks")
          .select("truck_number, mileage")
          .eq("company_id", companyId)
          .eq("id", truckId)
          .maybeSingle(),
        supabase
          .from("maintenance")
          .select("service_type, scheduled_date, completed_date, status, mileage")
          .eq("company_id", companyId)
          .eq("truck_id", truckId)
          .order("scheduled_date", { ascending: false })
          .limit(50),
        supabase
          .from("work_orders")
          .select("id, status")
          .eq("company_id", companyId)
          .eq("truck_id", truckId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("dvir")
          .select("inspection_date, has_defects, defects")
          .eq("company_id", companyId)
          .eq("truck_id", truckId)
          .order("inspection_date", { ascending: false })
          .limit(20),
      ])

      if (maintenanceResult.error || workOrdersResult.error || dvirResult.error) return ""

      const maintenanceRows = (maintenanceResult.data || []) as Row[]
      const workOrders = (workOrdersResult.data || []) as Row[]
      const dvirRows = (dvirResult.data || []) as Row[]

      const lastService = maintenanceRows.find((row) => String(row.completed_date || "").trim()) || maintenanceRows[0]
      const upcomingServices = maintenanceRows.filter((row) => {
        const scheduledIso = toIsoDate(row.scheduled_date)
        if (!scheduledIso) return false
        const status = String(row.status || "").toLowerCase()
        return new Date(scheduledIso) >= today && !["completed", "cancelled"].includes(status)
      })
      const openWorkOrders = workOrders.filter((row) => !["completed", "cancelled", "closed"].includes(String(row.status || "").toLowerCase()))
      const recentDefects = dvirRows.filter((row) => Boolean(row.has_defects)).length

      return [
        "Maintenance Context:",
        `- Truck: ${String((truckResult.data as Row | null)?.truck_number || truckId)}`,
        `- Last service date: ${String((lastService as Row | undefined)?.completed_date || (lastService as Row | undefined)?.scheduled_date || "unknown")}`,
        `- Mileage: ${String((truckResult.data as Row | null)?.mileage ?? (lastService as Row | undefined)?.mileage ?? "unknown")}`,
        `- Upcoming scheduled services: ${upcomingServices.length}`,
        `- Open work orders: ${openWorkOrders.length}`,
        `- Recent DVIR defects: ${recentDefects}`,
      ].join("\n")
    }

    const [maintenanceResult, workOrdersResult, trucksResult] = await Promise.all([
      supabase
        .from("maintenance")
        .select("truck_id, status, scheduled_date")
        .eq("company_id", companyId),
      supabase
        .from("work_orders")
        .select("truck_id, status")
        .eq("company_id", companyId),
      supabase
        .from("trucks")
        .select("id, status")
        .eq("company_id", companyId),
    ])

    if (maintenanceResult.error || workOrdersResult.error || trucksResult.error) return ""

    const maintenanceRows = (maintenanceResult.data || []) as Row[]
    const workOrders = (workOrdersResult.data || []) as Row[]
    const trucks = (trucksResult.data || []) as Row[]
    const weekEnd = addDays(today, 7)

    let overdueCount = 0
    let dueThisWeekCount = 0

    for (const row of maintenanceRows) {
      const scheduledIso = toIsoDate(row.scheduled_date)
      if (!scheduledIso) continue
      const status = String(row.status || "").toLowerCase()
      if (["completed", "cancelled"].includes(status)) continue
      const scheduled = new Date(scheduledIso)
      if (scheduled < today) overdueCount += 1
      if (scheduled >= today && scheduled <= weekEnd) dueThisWeekCount += 1
    }

    const trucksInShop = trucks.filter((row) =>
      ["maintenance", "in_shop", "repair", "out_of_service"].includes(String(row.status || "").toLowerCase())
    ).length
    const openWorkOrders = workOrders.filter((row) =>
      !["completed", "cancelled", "closed"].includes(String(row.status || "").toLowerCase())
    ).length

    return [
      "Maintenance Context:",
      `- Fleet overdue maintenance count: ${overdueCount}`,
      `- Maintenance due this week: ${dueThisWeekCount}`,
      `- Trucks currently in shop: ${trucksInShop}`,
      `- Open work orders: ${openWorkOrders}`,
    ].join("\n")
  } catch {
    return ""
  }
}
