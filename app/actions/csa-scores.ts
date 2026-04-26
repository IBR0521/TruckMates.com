"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { checkViewPermission } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"

type CSACategoryKey =
  | "unsafe_driving"
  | "hours_of_service"
  | "driver_fitness"
  | "controlled_substances"
  | "vehicle_maintenance"
  | "hazardous_materials"
  | "crash_indicator"

const CSA_LABELS: Record<CSACategoryKey, string> = {
  unsafe_driving: "Unsafe Driving",
  hours_of_service: "HOS Compliance",
  driver_fitness: "Driver Fitness",
  controlled_substances: "Controlled Substances",
  vehicle_maintenance: "Vehicle Maintenance",
  hazardous_materials: "Hazardous Materials",
  crash_indicator: "Crash Indicator",
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && line[i + 1] === '"') {
      current += '"'
      i++
      continue
    }
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (c === "," && !inQuotes) {
      values.push(current.trim())
      current = ""
      continue
    }
    current += c
  }
  values.push(current.trim())
  return values
}

function headerIndex(headers: string[], matchers: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().replace(/\s+/g, " ").trim()
    if (matchers.some((re) => re.test(h))) return i
  }
  return -1
}

function toPercent(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

function monthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

async function getCsaSnapshotText(): Promise<{ text: string; sourceUrl: string }> {
  const sourceUrl =
    process.env.FMCSA_SMS_SNAPSHOT_URL ||
    "https://ai.fmcsa.dot.gov/SMS/CarrierMonthlyData.csv"
  const response = await fetch(sourceUrl, { cache: "no-store" })
  if (!response.ok) throw new Error(`FMCSA snapshot download failed (${response.status})`)
  const text = await response.text()
  if (!text || text.length < 200) throw new Error("FMCSA snapshot response is empty")
  return { text, sourceUrl }
}

function parseCompanyScoresFromCsv(csvText: string, dotNumber: string) {
  const lines = csvText.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return null
  const headers = parseCsvLine(lines[0])
  const dotIdx = headerIndex(headers, [/usdot/, /dot number/, /^dot$/])
  if (dotIdx < 0) return null

  const idx = {
    unsafe_driving: headerIndex(headers, [/unsafe driving/]),
    hours_of_service: headerIndex(headers, [/hos/, /hours of service/]),
    driver_fitness: headerIndex(headers, [/driver fitness/]),
    controlled_substances: headerIndex(headers, [/controlled substances/, /alcohol/]),
    vehicle_maintenance: headerIndex(headers, [/vehicle maintenance/]),
    hazardous_materials: headerIndex(headers, [/hazardous materials/, /hazmat/]),
    crash_indicator: headerIndex(headers, [/crash indicator/, /^crash$/]),
  } as Record<CSACategoryKey, number>

  const wantedDot = String(dotNumber).replace(/\D/g, "")
  const row = lines
    .slice(1)
    .map(parseCsvLine)
    .find((cols) => String(cols[dotIdx] || "").replace(/\D/g, "") === wantedDot)
  if (!row) return null

  const result: Record<CSACategoryKey, number | null> = {
    unsafe_driving: idx.unsafe_driving >= 0 ? toPercent(row[idx.unsafe_driving]) : null,
    hours_of_service: idx.hours_of_service >= 0 ? toPercent(row[idx.hours_of_service]) : null,
    driver_fitness: idx.driver_fitness >= 0 ? toPercent(row[idx.driver_fitness]) : null,
    controlled_substances: idx.controlled_substances >= 0 ? toPercent(row[idx.controlled_substances]) : null,
    vehicle_maintenance: idx.vehicle_maintenance >= 0 ? toPercent(row[idx.vehicle_maintenance]) : null,
    hazardous_materials: idx.hazardous_materials >= 0 ? toPercent(row[idx.hazardous_materials]) : null,
    crash_indicator: idx.crash_indicator >= 0 ? toPercent(row[idx.crash_indicator]) : null,
  }
  return result
}

async function createThresholdAlerts(companyId: string, month: string, scores: Record<CSACategoryKey, number | null>) {
  const admin = createAdminClient()
  const overThreshold = Object.entries(scores).filter(([, value]) => Number(value) >= 65) as Array<[CSACategoryKey, number]>
  if (overThreshold.length === 0) return

  const { data: users } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .in("role", ["super_admin", "operations_manager", "owner", "admin", "manager", "safety_compliance"])

  for (const [key, value] of overThreshold) {
    const exists = await admin
      .from("alerts")
      .select("id")
      .eq("company_id", companyId)
      .eq("event_type", "csa_threshold")
      .contains("metadata", { category: key, snapshot_month: month })
      .limit(1)
    if (exists.data && exists.data.length > 0) continue

    const title = `CSA threshold crossed: ${CSA_LABELS[key]}`
    const message = `${CSA_LABELS[key]} is at ${value.toFixed(1)}%, above intervention threshold (65%).`
    const alertInsert = await admin.from("alerts").insert({
      company_id: companyId,
      title,
      message,
      event_type: "csa_threshold",
      priority: "high",
      status: "active",
      metadata: { category: key, score: value, snapshot_month: month, threshold: 65 },
    })
    if (alertInsert.error) continue

    const notificationRows = (users || []).map((u: any) => ({
      user_id: u.id,
      company_id: companyId,
      type: "violation_alert",
      title,
      message,
      priority: "high",
      read: false,
      metadata: { source: "csa_scores", category: key, score: value, snapshot_month: month },
    }))
    if (notificationRows.length > 0) {
      await admin.from("notifications").insert(notificationRows)
    }
  }
}

export async function syncCompanyCSAScores(companyId: string, dotNumber: string) {
  const admin = createAdminClient()
  const { text, sourceUrl } = await getCsaSnapshotText()
  const parsed = parseCompanyScoresFromCsv(text, dotNumber)
  if (!parsed) return { error: `USDOT ${dotNumber} not found in FMCSA snapshot`, data: null }
  const snapshotMonth = monthStart()

  const upsert = await admin
    .from("csa_scores")
    .upsert(
      {
        company_id: companyId,
        dot_number: dotNumber,
        snapshot_month: snapshotMonth,
        ...parsed,
        source_url: sourceUrl,
      },
      { onConflict: "company_id,snapshot_month" },
    )
  if (upsert.error) return { error: upsert.error.message, data: null }

  await createThresholdAlerts(companyId, snapshotMonth, parsed)
  return { data: { snapshot_month: snapshotMonth, ...parsed }, error: null }
}

export async function syncAllCompaniesCSAScores() {
  try {
    const admin = createAdminClient()
    const { data: settings, error } = await admin
      .from("company_settings")
      .select("company_id, dot_number")
      .not("dot_number", "is", null)
      .limit(10000)
    if (error) return { error: error.message, data: null }

    let synced = 0
    const errors: Array<{ company_id: string; error: string }> = []
    for (const row of settings || []) {
      const dot = String(row.dot_number || "").replace(/\D/g, "")
      if (!dot) continue
      const result = await syncCompanyCSAScores(String(row.company_id), dot)
      if (result.error) errors.push({ company_id: String(row.company_id), error: result.error })
      else synced++
    }
    revalidatePath("/dashboard/compliance")
    return { data: { synced, errors }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed CSA monthly sync"), data: null }
  }
}

export async function getCSAScoreHistory(limit = 12) {
  try {
    const permission = await checkViewPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data, error } = await supabase
      .from("csa_scores")
      .select("id, snapshot_month, unsafe_driving, hours_of_service, driver_fitness, controlled_substances, vehicle_maintenance, hazardous_materials, crash_indicator, dot_number")
      .eq("company_id", ctx.companyId)
      .order("snapshot_month", { ascending: false })
      .limit(Math.min(limit, 60))
    if (error) return { error: "Failed to load CSA scores", data: null }
    return { data: (data || []).reverse(), error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load CSA scores"), data: null }
  }
}
