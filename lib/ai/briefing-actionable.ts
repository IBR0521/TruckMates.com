import { createAdminClient } from "@/lib/supabase/admin"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import type { ProactiveAlert } from "@/lib/ai/notifications/proactive"
import type { AppRole } from "@/lib/ai/tools/types"
import type { BriefingAlert, BriefingRecommendation, MorningBriefing } from "@/lib/ai/briefing-types"
import { isAiBriefingActionableRecommendationsEnabled } from "@/lib/ai/feature-flags"

export type {
  BriefingSuggestedTool,
  BriefingEntityAllowlist,
} from "@/lib/ai/briefing-suggested-tool-validation"

export {
  parseBriefingSuggestedTool,
  buildBriefingToolCatalogSection,
  validateBriefingSuggestedTool,
  sanitizeBriefingSuggestedTools,
  countBriefingSuggestedTools,
} from "@/lib/ai/briefing-suggested-tool-validation"

import type {
  BriefingEntityAllowlist,
  BriefingSuggestedTool,
} from "@/lib/ai/briefing-suggested-tool-validation"

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
}

const ENTITY_FIELD_MAP: Array<{ key: string }> = [
  { key: "load_id" },
  { key: "source_load_id" },
  { key: "driver_id" },
  { key: "truck_id" },
  { key: "invoice_id" },
  { key: "maintenance_id" },
  { key: "customer_id" },
]

function entityKeyFromInput(input: Record<string, unknown>): string {
  for (const { key } of ENTITY_FIELD_MAP) {
    const v = String(input[key] || "").trim()
    if (v) return `${key}_${v.slice(0, 8)}`
  }
  const pickup = String(input.pickup_location || "").trim()
  if (pickup) return `loc_${slugKey(pickup)}`
  return "general"
}

export async function gatherBriefingEntityContext(companyId: string): Promise<{
  allowlist: BriefingEntityAllowlist
  referenceBlock: string
}> {
  const admin = createAdminClient()
  const allowlist: BriefingEntityAllowlist = {
    loadIds: new Set(),
    driverIds: new Set(),
    truckIds: new Set(),
    invoiceIds: new Set(),
    maintenanceIds: new Set(),
    customerIds: new Set(),
  }

  const [loads, drivers, trucks, invoices, maintenance, customers] = await Promise.all([
    admin
      .from("loads")
      .select("id, origin, destination, status, shipment_number")
      .eq("company_id", companyId)
      .in("status", ["pending", "confirmed", "scheduled", "in_transit"])
      .order("updated_at", { ascending: false })
      .limit(40),
    admin.from("drivers").select("id, name, status").eq("company_id", companyId).limit(40),
    admin.from("trucks").select("id, truck_number, status").eq("company_id", companyId).limit(40),
    admin
      .from("invoices")
      .select("id, invoice_number, status, amount")
      .eq("company_id", companyId)
      .in("status", ["pending", "sent", "overdue"])
      .limit(30),
    admin
      .from("maintenance")
      .select("id, service_type, status, truck_id, scheduled_date")
      .eq("company_id", companyId)
      .not("status", "in", '("completed","cancelled")')
      .limit(30),
    admin.from("customers").select("id, name").eq("company_id", companyId).limit(30),
  ])

  const refLines: string[] = ["Entity references (use these exact UUIDs in suggested_tool when applicable):"]

  for (const row of loads.data || []) {
    const id = String((row as { id?: string }).id || "")
    if (!id) continue
    allowlist.loadIds.add(id)
    const sn = String((row as { shipment_number?: string }).shipment_number || "").trim()
    const origin = String((row as { origin?: string }).origin || "").trim()
    const dest = String((row as { destination?: string }).destination || "").trim()
    refLines.push(
      `- load_id=${id}${sn ? ` shipment=${sn}` : ""}${origin ? ` origin=${origin}` : ""}${dest ? ` dest=${dest}` : ""}`,
    )
  }

  for (const row of drivers.data || []) {
    const id = String((row as { id?: string }).id || "")
    if (!id) continue
    allowlist.driverIds.add(id)
    refLines.push(`- driver_id=${id} name=${String((row as { name?: string }).name || "").trim() || "?"}`)
  }

  for (const row of trucks.data || []) {
    const id = String((row as { id?: string }).id || "")
    if (!id) continue
    allowlist.truckIds.add(id)
    refLines.push(
      `- truck_id=${id} unit=${String((row as { truck_number?: string }).truck_number || "").trim() || "?"}`,
    )
  }

  for (const row of invoices.data || []) {
    const id = String((row as { id?: string }).id || "")
    if (!id) continue
    allowlist.invoiceIds.add(id)
    refLines.push(
      `- invoice_id=${id} number=${String((row as { invoice_number?: string }).invoice_number || "").trim() || "?"}`,
    )
  }

  for (const row of maintenance.data || []) {
    const id = String((row as { id?: string }).id || "")
    if (!id) continue
    allowlist.maintenanceIds.add(id)
    refLines.push(`- maintenance_id=${id} service=${String((row as { service_type?: string }).service_type || "").trim()}`)
  }

  for (const row of customers.data || []) {
    const id = String((row as { id?: string }).id || "")
    if (!id) continue
    allowlist.customerIds.add(id)
  }

  if (refLines.length === 1) {
    refLines.push("- (No entity rows returned — suggested_tool should be null for id-based tools.)")
  }

  return { allowlist, referenceBlock: refLines.join("\n") }
}

function mapSeverityToPriority(severity: BriefingAlert["severity"]): ProactiveAlert["priority"] {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  return "medium"
}

function mapRecommendationPriority(priority: number): ProactiveAlert["priority"] {
  if (priority <= 1) return "high"
  if (priority <= 3) return "medium"
  return "medium"
}

export async function stageBriefingActionableRecommendations(params: {
  companyId: string
  briefingDate: string
  briefing: MorningBriefing
}): Promise<{ staged: number; skipped: number; failed: number }> {
  if (!isAiBriefingActionableRecommendationsEnabled()) {
    return { staged: 0, skipped: 0, failed: 0 }
  }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from("companies")
    .select("subscription_tier")
    .eq("id", params.companyId)
    .maybeSingle()
  const tier: PlanTier = normalizePlanTier((company as { subscription_tier?: string } | null)?.subscription_tier)

  if (!hasFeatureAccess(tier, "ai_smart_notifications") || !hasFeatureAccess(tier, "ai_advanced_actions")) {
    return { staged: 0, skipped: 0, failed: 0 }
  }

  const { data: recipient } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", params.companyId)
    .neq("role", "driver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  const userId = recipient && typeof (recipient as { id?: string }).id === "string" ? (recipient as { id: string }).id : null
  if (!userId) return { staged: 0, skipped: 0, failed: 0 }

  const { insertProactiveIfNew } = await import("@/lib/ai/notifications/process-company-smart")

  const ctx = {
    userId,
    userRole: "operations_manager" as AppRole,
    companyTier: tier,
  }

  type Candidate = {
    source: "recommendation" | "critical_alert"
    title: string
    body: string
    priority: ProactiveAlert["priority"]
    tool: BriefingSuggestedTool
  }

  const candidates: Candidate[] = []

  for (const rec of params.briefing.recommendations) {
    if (!rec.suggested_tool) continue
    candidates.push({
      source: "recommendation",
      title: rec.title,
      body: rec.reasoning,
      priority: mapRecommendationPriority(rec.priority),
      tool: rec.suggested_tool,
    })
  }

  for (const alert of params.briefing.critical_alerts) {
    if (!alert.suggested_tool) continue
    candidates.push({
      source: "critical_alert",
      title: alert.title,
      body: alert.description,
      priority: mapSeverityToPriority(alert.severity),
      tool: alert.suggested_tool,
    })
  }

  let staged = 0
  let skipped = 0
  let failed = 0

  for (const item of candidates) {
    const alertKey = `morning_briefing_${slugKey(item.title)}_${entityKeyFromInput(item.tool.tool_input)}`
    const alert: ProactiveAlert = {
      alert_type: "morning_briefing_recommendation",
      alert_key: alertKey,
      priority: item.priority,
      title: item.title,
      body: item.body,
      details: {
        briefing_date: params.briefingDate,
        briefing_source: item.source,
        briefing_title: item.title,
      },
      affected_resource_type: null,
      affected_resource_id: null,
      recommendation: {
        tool_name: item.tool.tool_name,
        tool_input: item.tool.tool_input,
        summary: item.title,
      },
    }

    const result = await insertProactiveIfNew(admin, params.companyId, alert, ctx)
    if (result === "created") staged += 1
    else if (result === "skipped") skipped += 1
    else failed += 1
  }

  return { staged, skipped, failed }
}
