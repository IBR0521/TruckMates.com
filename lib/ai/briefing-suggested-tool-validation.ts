import { validateToolInputSchema } from "@/lib/ai/tools/validate-input"
import {
  getAllToolMetadata,
  getToolMetadataByName,
  toolMetadataConfirmationRequired,
} from "@/lib/ai/tools/tool-metadata"
import type { MorningBriefing } from "@/lib/ai/briefing-types"

export type BriefingSuggestedTool = {
  tool_name: string
  tool_input: Record<string, unknown>
}

export type BriefingEntityAllowlist = {
  loadIds: Set<string>
  driverIds: Set<string>
  truckIds: Set<string>
  invoiceIds: Set<string>
  maintenanceIds: Set<string>
  customerIds: Set<string>
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UPDATE_LOAD_STATUSES = new Set([
  "pending",
  "confirmed",
  "in_transit",
  "delivered",
  "cancelled",
  "invoiced",
  "paid",
])

function isBriefingStageableTool(toolName: string, input: Record<string, unknown>): boolean {
  if (toolName !== "update_load_status") return false
  const loadId = String(input.load_id || "").trim()
  const status = String(input.new_status || "").trim().toLowerCase()
  return Boolean(loadId) && UPDATE_LOAD_STATUSES.has(status)
}

const ENTITY_FIELD_MAP: Array<{ key: string; set: keyof BriefingEntityAllowlist }> = [
  { key: "load_id", set: "loadIds" },
  { key: "source_load_id", set: "loadIds" },
  { key: "driver_id", set: "driverIds" },
  { key: "truck_id", set: "truckIds" },
  { key: "invoice_id", set: "invoiceIds" },
  { key: "maintenance_id", set: "maintenanceIds" },
  { key: "customer_id", set: "customerIds" },
]

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function parseBriefingSuggestedTool(raw: unknown): BriefingSuggestedTool | null {
  if (raw === null || raw === undefined) return null
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const tool_name = String(o.tool_name || "").trim()
  const tool_input = o.tool_input
  if (!tool_name) return null
  if (!tool_input || typeof tool_input !== "object" || Array.isArray(tool_input)) return null
  return { tool_name, tool_input: tool_input as Record<string, unknown> }
}

export function buildBriefingToolCatalogSection(): string {
  const lines = getAllToolMetadata()
    .filter((t) => !t.feature_flag || t.feature_flag())
    .map((t) => {
      const required = (t.input_schema.required || []).join(", ") || "(none)"
      return `- ${t.name}: ${t.description.split(".")[0]}. Required fields: ${required}`
    })
  return [
    "Available AI tools for suggested_tool (use exact tool_name; null when no clean match):",
    ...lines,
    "",
    "suggested_tool rules:",
    "- Only populate when a listed tool cleanly matches and every required input is grounded in Entity references or location text from this briefing context.",
    "- If no clean match, set suggested_tool to null — do not force weak matches.",
    "- Use exact UUIDs from Entity references for id fields; never invent ids.",
  ].join("\n")
}

export function validateBriefingSuggestedTool(
  suggested: BriefingSuggestedTool,
  allowlist: BriefingEntityAllowlist,
): BriefingSuggestedTool | null {
  const tool = getToolMetadataByName(suggested.tool_name)
  if (!tool) {
    console.warn("[briefing_actionable] Discarded unknown tool_name", { tool_name: suggested.tool_name })
    return null
  }

  const validated = validateToolInputSchema(suggested.tool_input, tool.input_schema)
  if (!validated.ok) {
    console.warn("[briefing_actionable] Discarded malformed tool_input", {
      tool_name: suggested.tool_name,
      error: validated.error,
    })
    return null
  }

  const input = validated.value

  if (tool.name === "send_invoice") {
    const inv = String(input.invoice_id || "").trim()
    const ld = String(input.load_id || "").trim()
    if (!inv && !ld) {
      console.warn("[briefing_actionable] Discarded send_invoice without invoice_id or load_id")
      return null
    }
  }

  for (const { key, set } of ENTITY_FIELD_MAP) {
    const raw = input[key]
    if (raw === undefined || raw === null || raw === "") continue
    const value = String(raw).trim()
    if (!isUuid(value)) {
      console.warn("[briefing_actionable] Discarded non-uuid entity reference", { tool_name: tool.name, key, value })
      return null
    }
    if (!allowlist[set].has(value)) {
      console.warn("[briefing_actionable] Discarded hallucinated entity id", { tool_name: tool.name, key, value })
      return null
    }
  }

  if (!toolMetadataConfirmationRequired(tool, input) && !isBriefingStageableTool(tool.name, input)) {
    console.warn("[briefing_actionable] Discarded read-only/non-actionable tool", { tool_name: tool.name })
    return null
  }

  return { tool_name: tool.name, tool_input: input }
}

export function sanitizeBriefingSuggestedTools(
  briefing: MorningBriefing,
  allowlist: BriefingEntityAllowlist,
): { validated: number; discarded: number; nullCount: number; rawNonNull: number } {
  let validated = 0
  let discarded = 0
  let nullCount = 0
  let rawNonNull = 0

  const process = <T extends { suggested_tool?: BriefingSuggestedTool | null }>(item: T): T => {
    if (item.suggested_tool === null || item.suggested_tool === undefined) {
      nullCount += 1
      return { ...item, suggested_tool: null }
    }
    rawNonNull += 1
    const ok = validateBriefingSuggestedTool(item.suggested_tool, allowlist)
    if (ok) {
      validated += 1
      return { ...item, suggested_tool: ok }
    }
    discarded += 1
    return { ...item, suggested_tool: null }
  }

  briefing.recommendations = briefing.recommendations.map(process)
  briefing.critical_alerts = briefing.critical_alerts.map(process)
  return { validated, discarded, nullCount, rawNonNull }
}

export function countBriefingSuggestedTools(briefing: MorningBriefing): {
  rawNonNull: number
  validatedNonNull: number
  totalSlots: number
} {
  const slots = [...briefing.recommendations, ...briefing.critical_alerts]
  const validatedNonNull = slots.filter((s) => s.suggested_tool != null).length
  return { rawNonNull: validatedNonNull, validatedNonNull, totalSlots: slots.length }
}
