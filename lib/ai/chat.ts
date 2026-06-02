import { callClaude } from "@/lib/ai/client"
import {
  callClaudeMessages,
  type ClaudeContentPart,
  type ClaudeMessage,
} from "@/lib/ai/client-messages"
import { chooseModel } from "@/lib/ai/model-router"
import { createAdminClient } from "@/lib/supabase/admin"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import type { AiMessage, AiResponse } from "@/lib/ai/types"
import {
  getComplianceContext,
  getDriverContext,
  getDriverRosterContext,
  getFinancialContext,
  getCompanyMemoryContext,
  getFleetContext,
  getLoadContext,
  getMaintenanceContext,
  getPreferenceContext,
  getTruckRosterContext,
} from "@/lib/ai/context"
import { executeToolForChat as execTool } from "@/lib/ai/tools/executor"
import {
  anthropicToolsFromRegistry,
  getAvailableTools,
  getToolByName,
  toolConfirmationRequired,
} from "@/lib/ai/tools/registry"
import type { AppRole } from "@/lib/ai/tools/types"
import type { PlanTier } from "@/lib/plan-limits"
import { hasFeatureAccess, planTierLabel } from "@/lib/plan-limits"
import { logAiUsage } from "@/lib/ai/usage"
import {
  buildAnswerCacheKey,
  computeContextVersionHash,
  conversationFingerprint,
  getCachedAnswer,
  normalizeQuestion,
  setCachedAnswer,
} from "@/lib/ai/answer-cache"
import { VOICE_BREVITY_HINT } from "@/lib/ai/voice-chat"
import {
  categorizeSafetyCompliance,
  EXPLAINABILITY_PROMPT_VERSION_CHAT,
  extractRelevantDataPointsFromContext,
  insertExplainabilityRecord,
  sha256,
} from "@/lib/ai/explainability"

export type AiChatContextType = "fleet" | "driver" | "load" | "financial" | "compliance" | "maintenance"

export type PersistedToolCall = { id: string; name: string; input: Record<string, unknown> }
export type PersistedToolResult = { tool_use_id: string; content: string; is_error?: boolean }

export type AiChatHistoryRow = {
  role: "user" | "assistant"
  content: string
  tool_calls?: PersistedToolCall[] | null
  tool_results?: PersistedToolResult[] | null
}

const ALL_CONTEXT_TYPES: AiChatContextType[] = [
  "fleet",
  "driver",
  "load",
  "financial",
  "compliance",
  "maintenance",
]

const CLASSIFIER_SYSTEM = `You classify logistics questions for a fleet TMS assistant.
Return ONLY valid JSON with keys: "contextTypes" (array of strings) and "reasoning" (short string).
Allowed contextTypes values: fleet, driver, load, financial, compliance, maintenance.
Pick the minimal set needed to answer the user's latest question.`

/**
 * Deterministic keyword → context-type routes for the fast classifier path. Terms are matched on
 * word boundaries (with an optional trailing "s") against the latest user message. Kept to obvious,
 * domain-unambiguous terms so we only skip the LLM classifier when we are confident.
 */
const KEYWORD_ROUTES: ReadonlyArray<{ type: AiChatContextType; terms: readonly string[] }> = [
  { type: "fleet", terms: ["truck", "trailer", "fleet", "vehicle"] },
  { type: "driver", terms: ["driver", "hos", "cdl", "hours of service", "endorsement"] },
  { type: "load", terms: ["load", "dispatch", "pickup", "pick up", "delivery", "shipment"] },
  { type: "financial", terms: ["invoice", "payment", "ar", "accounts receivable", "revenue", "expense", "billing"] },
  { type: "compliance", terms: ["csa", "compliance", "ifta", "registration"] },
  { type: "maintenance", terms: ["maintenance", "dvir", "work order"] },
]

const MAX_TOOL_ITERATIONS = 5
const MAX_DESTRUCTIVE_PER_TURN = 3

/**
 * Post-generation numeric verification.
 *
 * After the model writes its FINAL answer we extract monetary figures ($1,234.56) and large
 * standalone numbers, then confirm each appears in the context we actually provided this turn
 * (system blocks + grounding context + tool results + the user's question). Figures that do not
 * appear are not silently shipped — they are flagged so hallucinated numbers can be reviewed.
 *
 * Conservative by design: currency is always checked; bare numbers are only checked above
 * `threshold` (so HOS hours, small counts, percentages, and years are ignored), and obvious
 * structural tokens (IDs, dates) are skipped during extraction.
 */
const NUMERIC_VERIFICATION = {
  enabled: true,
  /**
   * Bare (non-$) integers/decimals below this are treated as structural (HOS hours like 11/14/70,
   * counts, percentages, small quantities) and never flagged. Currency amounts are always checked.
   */
  threshold: 1000,
  /**
   * What to do with unverified figures:
   * - "log" (preferred): write a structured warning to the AI usage/audit log for review.
   * - "caveat": append a brief unverified-figures note to the response shown to the user.
   * - "both": do both.
   */
  mode: "log" as "log" | "caveat" | "both",
  /** Cap distinct flagged figures acted on per turn (avoids runaway logging on number-heavy text). */
  maxFlagged: 12,
  /** Caveat appended to the response when `mode` includes "caveat". */
  caveat:
    "\n\n_Note: one or more figures above could not be verified against current company data and may be estimates — please double-check before relying on them._",
} as const

/**
 * Session entity ledger. Tracks the most recent entities created or modified by tool calls in a
 * conversation (type + id + label, e.g. load/<uuid>/"Chicago -> Dallas"), persisted on
 * ai_conversations.session_entities. Injected each turn so the model can resolve "it" / "that load"
 * without re-parsing tool history. Capped to the most recent {@link SESSION_ENTITY_CAP}.
 */
const SESSION_ENTITY_CAP = 15

export type SessionEntity = { type: string; id: string; label: string }

/** Minimal structural view of a tool outcome (avoids importing the executor's return type). */
type ToolOutcomeLike = {
  status: string
  result?: unknown
  preview?: { summary: string; affected: Array<{ type: string; id: string; label: string }> }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Read-only lookup tools (find_ and get_ prefixed) don't create/modify entities, so skip them. */
function isMutationTool(toolName: string): boolean {
  return !/^(find_|get_)/.test(toolName)
}

/** Best-effort human label for a touched entity from a tool result payload. */
function deriveEntityLabel(result: unknown): string {
  const r = asRecord(result)
  const nested = asRecord(r.load || r.invoice || r.driver || r.truck)
  const pick = (source: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
      const value = String(source[key] ?? "").trim()
      if (value) return value
    }
    return ""
  }
  const labelKeys = ["shipment_number", "load_number", "invoice_number", "name", "title", "truck_number"]
  const direct = pick(r, labelKeys) || pick(nested, labelKeys)
  if (direct) return direct
  const origin = String(r.origin ?? r.pickup_location ?? nested.origin ?? "").trim()
  const dest = String(r.destination ?? r.delivery_location ?? nested.destination ?? "").trim()
  if (origin && dest) return `${origin} -> ${dest}`
  return ""
}

/** Resolve the entity id from a tool result when not available from input/preview. */
function resultEntityId(result: unknown): string {
  const r = asRecord(result)
  const direct = String(r.id ?? "")
  if (direct) return direct
  for (const key of ["load", "invoice", "driver", "truck"]) {
    const nestedId = String(asRecord(r[key]).id ?? "")
    if (nestedId) return nestedId
  }
  return ""
}

/** Derive {type,id} from a mutation tool's input (mirrors the executor's affected-resource logic). */
function entityFromInput(toolName: string, input: Record<string, unknown>): { type: string; id: string } | null {
  const loadId = String(input.load_id ?? input.source_load_id ?? "")
  if (toolName.includes("load") && loadId) return { type: "load", id: loadId }
  if (input.invoice_id) return { type: "invoice", id: String(input.invoice_id) }
  if (loadId) return { type: "load", id: loadId }
  if (input.driver_id) return { type: "driver", id: String(input.driver_id) }
  if (input.truck_id) return { type: "truck", id: String(input.truck_id) }
  if (input.maintenance_id) return { type: "maintenance", id: String(input.maintenance_id) }
  return null
}

/** Extract the entities a single mutation tool call touched, from its preview/input/result. */
function extractTouchedEntities(
  toolName: string,
  input: Record<string, unknown>,
  outcome: ToolOutcomeLike,
): SessionEntity[] {
  if (!isMutationTool(toolName)) return []

  // Pending confirmations carry rich, labeled affected resources from the tool's preview().
  if (outcome.preview?.affected?.length) {
    return outcome.preview.affected
      .filter((a) => a.id && a.id !== "(new)")
      .map((a) => ({ type: a.type, id: a.id, label: String(a.label || "").trim() }))
  }

  // Executed/auto-executed: derive from input, plus a label/id from the result.
  const label = deriveEntityLabel(outcome.result)
  const resultId = resultEntityId(outcome.result)

  if (toolName === "create_load" || toolName === "copy_load") {
    const id = resultId || String(input.load_id ?? input.source_load_id ?? "")
    return id && id !== "(new)" ? [{ type: "load", id, label }] : []
  }

  const fromInput = entityFromInput(toolName, input)
  if (fromInput) return [{ type: fromInput.type, id: fromInput.id, label }]
  if (resultId) return [{ type: "record", id: resultId, label }]
  return []
}

/** Merge incoming entities into the ledger (dedupe by type+id, newest last), cap to most recent N. */
function mergeSessionEntities(existing: SessionEntity[], incoming: SessionEntity[]): SessionEntity[] {
  const merged = [...existing]
  for (const entity of incoming) {
    if (!entity.id || !entity.type) continue
    const idx = merged.findIndex((e) => e.type === entity.type && e.id === entity.id)
    // Re-touch moves the entity to the end (most recent); keep the richer label.
    if (idx >= 0) {
      const prev = merged[idx]
      merged.splice(idx, 1)
      merged.push({ type: entity.type, id: entity.id, label: entity.label || prev.label })
    } else {
      merged.push({ type: entity.type, id: entity.id, label: entity.label })
    }
  }
  return merged.slice(-SESSION_ENTITY_CAP)
}

function parseSessionEntities(raw: unknown): SessionEntity[] {
  if (!Array.isArray(raw)) return []
  const out: SessionEntity[] = []
  for (const item of raw) {
    const r = asRecord(item)
    const type = String(r.type ?? "").trim()
    const id = String(r.id ?? "").trim()
    if (!type || !id) continue
    out.push({ type, id, label: String(r.label ?? "").trim() })
  }
  return out.slice(-SESSION_ENTITY_CAP)
}

/** Load the persisted ledger for a conversation (best-effort; returns [] on any error). */
async function loadSessionEntities(companyId: string, conversationId: string): Promise<SessionEntity[]> {
  try {
    if (!companyId || !conversationId) return []
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("ai_conversations")
      .select("session_entities")
      .eq("id", conversationId)
      .eq("company_id", companyId)
      .maybeSingle()
    if (error || !data) return []
    return parseSessionEntities((data as { session_entities?: unknown }).session_entities)
  } catch {
    return []
  }
}

/** Persist the merged ledger back to the conversation (best-effort; never throws). */
async function persistSessionEntities(
  companyId: string,
  conversationId: string,
  entities: SessionEntity[],
): Promise<void> {
  try {
    if (!companyId || !conversationId) return
    const admin = createAdminClient()
    await admin
      .from("ai_conversations")
      .update({ session_entities: entities })
      .eq("id", conversationId)
      .eq("company_id", companyId)
  } catch {
    // Best-effort only.
  }
}

/** Render the ledger as a short, parseable context block (most recent first). */
function renderSessionEntityLedger(entities: SessionEntity[]): string {
  if (entities.length === 0) return ""
  const lines = [...entities]
    .reverse()
    .map((e) => `- ${e.type}/${e.id}${e.label ? ` "${e.label}"` : ""}`)
  return [
    "Entities touched this session (most recent first — use to resolve references like \"it\"/\"that load\"):",
    ...lines,
  ].join("\n")
}

/**
 * Dispatch/assignment tools that need entity-level driver & truck rosters (ids, HOS, locations,
 * assignments) to call correctly. Only fetch the rosters when one of these is available this
 * request — they are token-heavy and useless for general chat.
 */
const ROSTER_CONTEXT_TOOLS = new Set<string>([
  "assign_driver_to_load",
  "find_best_truck_for_load",
  "find_available_drivers_near_location",
  "update_driver_status",
])
/** Billing: tool turns log multiple `ai_chat_tools` rows (schema + tool_result blocks); expect roughly $0.05–$0.15 USD per user turn on Sonnet when tools run. */

const TOOL_LOOP_GUIDANCE = `
Tool-use rules (when action tools are enabled for this request):
- Prefer ONE mutation tool per turn unless the user explicitly requested multiple steps.
- Read-only tools (find_best_truck_for_load, find_available_drivers_near_location, get_load_profitability_analysis, get_driver_performance_summary) never require confirmation.
- Mutation tools may return pending_user_confirmation payloads until approved in the UI — acknowledge that plainly.
- Never invent UUIDs; ask for missing identifiers.
`.trim()

const CHAT_REPLY_INSTRUCTIONS = `
You are answering inside TruckMates (fleet TMS). Follow the TruckMates AI rules in your system prompt.
Use ONLY the cached company context blocks attached for factual claims about this carrier.
If the context does not contain enough information, say what is missing and suggest where in TruckMates the user should look.
Keep answers concise and operational.
`.trim()

export function buildClaudeThread(rows: AiChatHistoryRow[]): ClaudeMessage[] {
  const out: ClaudeMessage[] = []
  for (const row of rows) {
    if (row.role === "user") {
      const c = row.content.trim()
      if (c) out.push({ role: "user", content: c })
      continue
    }
    const calls = Array.isArray(row.tool_calls) ? row.tool_calls : []
    const results = Array.isArray(row.tool_results) ? row.tool_results : []
    if (calls.length === 0) {
      if (row.content.trim()) out.push({ role: "assistant", content: row.content.trim() })
      continue
    }
    const assistantParts: ClaudeContentPart[] = []
    if (row.content.trim()) assistantParts.push({ type: "text", text: row.content.trim() })
    for (const c of calls) {
      assistantParts.push({ type: "tool_use", id: c.id, name: c.name, input: c.input })
    }
    out.push({ role: "assistant", content: assistantParts })
    const userParts: ClaudeContentPart[] = results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.tool_use_id,
      content: r.content,
      is_error: r.is_error,
    }))
    if (userParts.length > 0) {
      out.push({ role: "user", content: userParts })
    }
  }
  return out
}

function parseContextTypes(raw: unknown): AiChatContextType[] {
  if (!raw || typeof raw !== "object") return [...ALL_CONTEXT_TYPES]
  const types = (raw as { contextTypes?: unknown }).contextTypes
  if (!Array.isArray(types)) return [...ALL_CONTEXT_TYPES]
  const allowed = new Set<string>(ALL_CONTEXT_TYPES)
  const out: AiChatContextType[] = []
  for (const entry of types) {
    const key = String(entry || "").trim().toLowerCase()
    if (allowed.has(key)) out.push(key as AiChatContextType)
  }
  return out.length > 0 ? out : [...ALL_CONTEXT_TYPES]
}

/**
 * Fast, deterministic context router. Maps obvious domain terms in the latest user message to
 * context types so unambiguous questions can skip the classifier LLM call entirely. Returns null
 * when no obvious term matches (ambiguous) so callers fall back to the LLM classifier — keeping the
 * existing behavior for ambiguous queries. Results follow the canonical {@link ALL_CONTEXT_TYPES} order.
 */
export function classifyByKeywords(userMessage: string): AiChatContextType[] | null {
  const text = String(userMessage || "").toLowerCase()
  if (!text.trim()) return null

  const matched = new Set<AiChatContextType>()
  for (const route of KEYWORD_ROUTES) {
    for (const term of route.terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      if (new RegExp(`\\b${escaped}s?\\b`).test(text)) {
        matched.add(route.type)
        break
      }
    }
  }

  if (matched.size === 0) return null
  return ALL_CONTEXT_TYPES.filter((t) => matched.has(t))
}

export async function determineRequiredContext(params: {
  userMessage: string
  previousMessages: AiMessage[]
  companyId: string
}): Promise<{
  contextTypes: AiChatContextType[]
  reasoning: string
}> {
  // Fast path: an obvious keyword match skips the classifier LLM call entirely.
  const keywordMatch = classifyByKeywords(params.userMessage)
  if (keywordMatch) {
    return { contextTypes: keywordMatch, reasoning: "Keyword router matched (skipped LLM classifier)." }
  }

  const recent = params.previousMessages.slice(-6)
  const transcript = recent.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")

  const userBlock = [
    "Latest user message:",
    params.userMessage.trim(),
    "",
    "Recent conversation (may be empty):",
    transcript || "(none)",
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(CLASSIFIER_SYSTEM, userBlock, {
    expectJson: true,
    model: chooseModel("classify"),
    maxTokens: 256,
    feature: "ai_chat_context",
    companyId: params.companyId,
    cacheSystemPrompt: true,
  })

  if (res.error || !res.data) {
    return { contextTypes: [...ALL_CONTEXT_TYPES], reasoning: "Classifier unavailable; using full context." }
  }

  const reasoning =
    typeof (res.data as { reasoning?: unknown }).reasoning === "string"
      ? String((res.data as { reasoning: string }).reasoning)
      : "classified"

  return {
    contextTypes: parseContextTypes(res.data),
    reasoning,
  }
}

async function gatherContextBlocks(
  companyId: string,
  types: AiChatContextType[],
): Promise<{ text: string; used: string[] }> {
  const jobs: Array<Promise<{ key: AiChatContextType; text: string }>> = []

  for (const t of types) {
    if (t === "fleet") jobs.push(getFleetContext(companyId).then((text) => ({ key: t, text })))
    if (t === "driver") jobs.push(getDriverContext(companyId).then((text) => ({ key: t, text })))
    if (t === "load") jobs.push(getLoadContext(companyId).then((text) => ({ key: t, text })))
    if (t === "financial") jobs.push(getFinancialContext(companyId).then((text) => ({ key: t, text })))
    if (t === "compliance") jobs.push(getComplianceContext(companyId).then((text) => ({ key: t, text })))
    if (t === "maintenance") jobs.push(getMaintenanceContext(companyId).then((text) => ({ key: t, text })))
  }

  const settled = await Promise.all(jobs)
  const used: string[] = []
  const parts: string[] = []
  for (const row of settled) {
    const trimmed = row.text.trim()
    if (!trimmed) continue
    parts.push(trimmed)
    used.push(row.key)
  }

  return { text: parts.join("\n\n"), used }
}

type ClaudeSystemBlock = {
  type: "text"
  text: string
  cache_control?: { type: "ephemeral" }
}

function buildTierContextBlock(params: {
  tier: PlanTier
  toolsActiveThisRequest: boolean
  planSupportsActionTools: boolean
  hasSmartNotifications: boolean
  remainingCalls: number
}): string {
  const tierName = planTierLabel(params.tier)
  const toolsLine = params.toolsActiveThisRequest
    ? "yes (Professional+ unlocked)"
    : params.planSupportsActionTools
      ? "no (Professional+: action tools are turned off in assistant settings, not available for your role, or not active this request)"
      : "no (upgrade to Professional to unlock)"
  const smartLine = params.hasSmartNotifications
    ? "active"
    : "inactive (Professional+ unlocks)"
  const callsLine = params.remainingCalls === -1 ? "unlimited" : String(params.remainingCalls)

  return [
    "Current user context:",
    `- Subscription tier: ${tierName}`,
    `- AI action tools available: ${toolsLine}`,
    `- Smart notifications: ${smartLine}`,
    `- AI calls remaining this month: ${callsLine}`,
    "",
    "When answering questions about what you can do, refer to this context. Do not invent capabilities or limitations.",
  ].join("\n")
}

/**
 * System blocks: stable prompts cached; tier + grounding vary per request/company.
 * Order: LOGISTICS (cached) → tool loop guidance if tools active (cached) → tier context (NOT cached) → company cache (cached).
 */
function buildSystemBlocks(params: {
  includeToolLoopGuidance: boolean
  cacheContext: string
  tier: PlanTier
  toolsActiveThisRequest: boolean
  remainingCalls: number
}): ClaudeSystemBlock[] {
  const hasSmart = hasFeatureAccess(params.tier, "ai_smart_notifications")
  const planSupportsActionTools = hasAdvancedActionsTier(params.tier)
  const tierText = buildTierContextBlock({
    tier: params.tier,
    toolsActiveThisRequest: params.toolsActiveThisRequest,
    planSupportsActionTools,
    hasSmartNotifications: hasSmart,
    remainingCalls: params.remainingCalls,
  })

  const blocks: ClaudeSystemBlock[] = [
    { type: "text", text: LOGISTICS_SYSTEM_PROMPT.trim(), cache_control: { type: "ephemeral" } },
  ]
  if (params.includeToolLoopGuidance) {
    blocks.push({ type: "text", text: TOOL_LOOP_GUIDANCE, cache_control: { type: "ephemeral" } })
  }
  blocks.push({ type: "text", text: tierText })
  blocks.push({ type: "text", text: params.cacheContext, cache_control: { type: "ephemeral" } })
  return blocks
}

function hasAdvancedActionsTier(tier: PlanTier): boolean {
  return hasFeatureAccess(tier, "ai_advanced_actions")
}

/** Whether action/analysis tools are on the table for this request (role + tier + toggle). */
export function chatToolsEligible(params: {
  enableTools: boolean
  companyTier: PlanTier
  userRole: AppRole
}): boolean {
  return (
    params.enableTools &&
    hasAdvancedActionsTier(params.companyTier) &&
    getAvailableTools({ userRole: params.userRole, companyTier: params.companyTier }).length > 0
  )
}

export type BuiltChatRequest = {
  systemBlocks: ClaudeSystemBlock[]
  loopMessages: ClaudeMessage[]
  toolsDefs: ReturnType<typeof anthropicToolsFromRegistry> | undefined
  toolsEligible: boolean
  contextUsed: string[]
  reasoning: string
  cacheContext: string
}

/**
 * Single source of truth for chat request assembly: context classification + grounding blocks,
 * dispatch rosters, tool defs, system prompt (cached blocks) and the message thread. Both the
 * non-streaming {@link handleChatMessage} and the streaming route call this so the EXACT same
 * context, role gating, plan-tier handling and system prompt are used in both paths.
 */
export async function buildChatRequest(params: {
  companyId: string
  userId: string
  userRole: AppRole
  companyTier: PlanTier
  conversationId: string
  userMessage: string
  conversationHistory: AiChatHistoryRow[]
  enableTools: boolean
  remainingAiCalls: number
  /** Optional precomputed classification (lets the caller classify once for the cache lookup). */
  precomputedContext?: { contextTypes: AiChatContextType[]; reasoning: string }
  /** When true, append voice brevity instructions (hands-busy / spoken replies). */
  voiceMode?: boolean
}): Promise<BuiltChatRequest> {
  const sliceForClassifier: AiMessage[] = params.conversationHistory.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const { contextTypes, reasoning } =
    params.precomputedContext ??
    (await determineRequiredContext({
      userMessage: params.userMessage,
      previousMessages: sliceForClassifier,
      companyId: params.companyId,
    }))

  const { text: contextBlock, used } = await gatherContextBlocks(params.companyId, contextTypes)

  const toolsEligible = chatToolsEligible({
    enableTools: params.enableTools,
    companyTier: params.companyTier,
    userRole: params.userRole,
  })

  const toolsDefs = toolsEligible
    ? anthropicToolsFromRegistry(getAvailableTools({ userRole: params.userRole, companyTier: params.companyTier }))
    : undefined

  // Only attach entity-level rosters when a dispatch/assignment tool is on the table this request.
  const includeRosterContext = Boolean(toolsDefs?.some((t) => ROSTER_CONTEXT_TOOLS.has(t.name)))
  const rosterBlock = includeRosterContext
    ? (
        await Promise.all([
          getDriverRosterContext(params.companyId),
          getTruckRosterContext(params.companyId),
        ])
      )
        .map((text) => text.trim())
        .filter(Boolean)
        .join("\n\n")
    : ""

  // Learned approve/reject preferences only matter when action tools are on the table this request.
  const preferenceBlock = toolsDefs?.length ? (await getPreferenceContext(params.companyId)).trim() : ""

  // Session entity ledger: injected every turn (cheap, ≤15 lines) so the model can resolve
  // references like "it" / "that load" against entities tool calls touched earlier this session.
  const ledger = await loadSessionEntities(params.companyId, params.conversationId)
  const ledgerBlock = renderSessionEntityLedger(ledger)

  // Distilled per-company memory (aliases, recurring questions, preferences) — small and capped.
  const memoryBlock = (await getCompanyMemoryContext(params.companyId)).trim()

  const groundingBlock = [contextBlock.trim(), rosterBlock, preferenceBlock, ledgerBlock, memoryBlock]
    .filter(Boolean)
    .join("\n\n")

  const cacheContext = [
    `Conversation: ${params.conversationId}`,
    `User: ${params.userId}`,
    `Context selection reasoning: ${reasoning}`,
    "",
    "=== Grounding context (this company) ===",
    groundingBlock || "(no structured context available for the selected domains)",
  ].join("\n")

  const userPrompt = [
    params.voiceMode ? `${CHAT_REPLY_INSTRUCTIONS}\n${VOICE_BREVITY_HINT}` : CHAT_REPLY_INSTRUCTIONS,
    "",
    "Latest user message:",
    params.userMessage.trim(),
  ].join("\n")

  const loopMessages: ClaudeMessage[] = [
    ...buildClaudeThread(params.conversationHistory),
    { role: "user", content: userPrompt },
  ]

  const systemBlocks = buildSystemBlocks({
    includeToolLoopGuidance: Boolean(toolsDefs?.length),
    cacheContext,
    tier: params.companyTier,
    toolsActiveThisRequest: Boolean(toolsDefs?.length),
    remainingCalls: params.remainingAiCalls,
  })

  return { systemBlocks, loopMessages, toolsDefs, toolsEligible, contextUsed: used, reasoning, cacheContext }
}

type NumericClaim = { raw: string; value: number; currency: boolean }

/** Collapse currency/grouping noise so figures match across formatting differences ($ and commas). */
function normalizeNumeric(text: string): string {
  return text.replace(/[$,]/g, "")
}

/** A 4-digit integer in a plausible calendar-year range — skip so we don't flag dates as figures. */
function isLikelyYear(raw: string, value: number): boolean {
  return /^\d{4}$/.test(raw) && value >= 1900 && value <= 2100
}

/**
 * Extract monetary figures and large standalone numbers from the model's answer. Currency is always
 * returned; bare numbers only when >= threshold and not obviously structural (IDs/dates/years).
 */
function extractNumericClaims(text: string): NumericClaim[] {
  const claims: NumericClaim[] = []
  const seen = new Set<string>()

  // Currency amounts (always checked regardless of magnitude), e.g. $1,234.56 or $900.
  const currencyRe = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\s?\d+(?:\.\d{1,2})?/g
  for (const match of text.matchAll(currencyRe)) {
    const raw = match[0]
    const value = Number(raw.replace(/[$,\s]/g, ""))
    if (!Number.isFinite(value) || value === 0) continue
    const key = `$${value}`
    if (seen.has(key)) continue
    seen.add(key)
    claims.push({ raw, value, currency: true })
  }

  // Comma-grouped numbers (inherently >= 1,000) not already part of a $ figure.
  const groupedRe = /(?<![\w$.\-])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\w%\-])/g
  for (const match of text.matchAll(groupedRe)) {
    const raw = match[0]
    const value = Number(raw.replace(/,/g, ""))
    if (!Number.isFinite(value) || value < NUMERIC_VERIFICATION.threshold) continue
    const key = `n${value}`
    if (seen.has(key)) continue
    seen.add(key)
    claims.push({ raw, value, currency: false })
  }

  // Large plain numbers (4+ digits, ungrouped), excluding year-like values and IDs/dates (the
  // lookbehind/lookahead reject digits glued to letters, '-', '.', ',' or '%').
  const plainRe = /(?<![\w$.,\-])\d{4,}(?:\.\d+)?(?![\w%\-])/g
  for (const match of text.matchAll(plainRe)) {
    const raw = match[0]
    const value = Number(raw)
    if (!Number.isFinite(value) || value < NUMERIC_VERIFICATION.threshold) continue
    if (isLikelyYear(raw, value)) continue
    const key = `n${value}`
    if (seen.has(key)) continue
    seen.add(key)
    claims.push({ raw, value, currency: false })
  }

  return claims
}

/** Candidate string forms of a figure to test against the (normalized) context haystack. */
function numericVariants(raw: string, value: number): string[] {
  const variants = new Set<string>()
  variants.add(raw.replace(/[$,\s]/g, ""))
  variants.add(String(value))
  variants.add(value.toFixed(2))
  if (Number.isInteger(value)) variants.add(String(Math.trunc(value)))
  return [...variants].filter(Boolean)
}

/**
 * Everything the model actually saw this turn, EXCEPT its own generated text: system blocks
 * (system prompt + tier context + grounding context) plus the user's question and any tool-result
 * data. Assistant text/tool_use is excluded so we never "verify" a number against the model's own claim.
 */
function buildVerificationHaystack(systemBlocks: ClaudeSystemBlock[], messages: ClaudeMessage[]): string {
  const parts: string[] = []
  for (const block of systemBlocks) parts.push(block.text)
  for (const message of messages) {
    if (message.role === "assistant") continue
    if (typeof message.content === "string") {
      parts.push(message.content)
      continue
    }
    for (const part of message.content) {
      if (part.type === "tool_result" && typeof part.content === "string") parts.push(part.content)
    }
  }
  return parts.join("\n")
}

/**
 * Returns figures in `answer` that do NOT appear in the provided context, capped at `maxFlagged`.
 */
function findUnverifiedNumericClaims(
  answer: string,
  systemBlocks: ClaudeSystemBlock[],
  messages: ClaudeMessage[],
): NumericClaim[] {
  const normalizedHaystack = normalizeNumeric(buildVerificationHaystack(systemBlocks, messages))
  const unverified: NumericClaim[] = []
  for (const claim of extractNumericClaims(answer)) {
    const verified = numericVariants(claim.raw, claim.value).some((variant) =>
      normalizedHaystack.includes(normalizeNumeric(variant)),
    )
    if (!verified) unverified.push(claim)
    if (unverified.length >= NUMERIC_VERIFICATION.maxFlagged) break
  }
  return unverified
}

export async function handleChatMessage(params: {
  companyId: string
  userId: string
  userRole: AppRole
  companyTier: PlanTier
  conversationId: string
  userMessage: string
  conversationHistory: AiChatHistoryRow[]
  enableTools: boolean
  /** Monthly AI call budget remaining (-1 = unlimited). */
  remainingAiCalls: number
  /** Hands-busy voice mode — shorter spoken-style replies. */
  voiceMode?: boolean
}): Promise<
  AiResponse<{
    responseText: string
    contextUsed: string[]
    toolCallsExecuted: Array<{ name: string; result: unknown }>
    pendingConfirmations: Array<{
      auditId: string
      toolName: string
      toolUseId: string
      summary: string
      affected: Array<{ type: string; id: string; label: string }>
    }>
    mergedToolCalls: PersistedToolCall[]
    mergedToolResults: PersistedToolResult[]
    firstPendingToolUseId: string | null
    auditIdsForMessageLink: string[]
  }>
> {
  // Classify once up-front so we can both check the answer cache and reuse the result for the
  // full request build (avoids a duplicate classifier call).
  const classifierSlice: AiMessage[] = params.conversationHistory.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }))
  const classification = await determineRequiredContext({
    userMessage: params.userMessage,
    previousMessages: classifierSlice,
    companyId: params.companyId,
  })

  // Short-TTL read-only answer cache. Keyed on company + normalized question + conversation
  // fingerprint + context-version hash. Only consulted/populated for pure read-only answers below.
  const admin = createAdminClient()
  const normalizedQuestion = normalizeQuestion(params.userMessage)
  const contextVersionHash = await computeContextVersionHash(admin, params.companyId, classification.contextTypes)
  const answerCacheKey = buildAnswerCacheKey({
    companyId: params.companyId,
    normalizedQuestion,
    historyFingerprint: conversationFingerprint(params.conversationHistory),
    contextVersionHash,
  })

  if (normalizedQuestion && !params.voiceMode) {
    const cached = await getCachedAnswer({ companyId: params.companyId, cacheKey: answerCacheKey })
    if (cached) {
      return {
        data: {
          responseText: cached.answer,
          contextUsed: cached.contextUsed,
          toolCallsExecuted: [],
          pendingConfirmations: [],
          mergedToolCalls: [],
          mergedToolResults: [],
          firstPendingToolUseId: null,
          auditIdsForMessageLink: [],
        },
        error: null,
        tokensUsed: 0,
        model: "cache",
        quotaWarning: false,
      }
    }
  }

  const { systemBlocks, loopMessages, toolsDefs, contextUsed: used, cacheContext } = await buildChatRequest({
    ...params,
    precomputedContext: classification,
  })

  let iterations = 0
  let quotaWarning = false
  let tokensUsedTotal = 0
  let modelLast: string | undefined

  const responsePieces: string[] = []
  const mergedToolCalls: PersistedToolCall[] = []
  const mergedToolResults: PersistedToolResult[] = []
  const pendingConfirmations: Array<{
    auditId: string
    toolName: string
    toolUseId: string
    summary: string
    affected: Array<{ type: string; id: string; label: string }>
  }> = []
  const toolCallsExecuted: Array<{ name: string; result: unknown }> = []
  const auditIdsForMessageLink: string[] = []
  const touchedEntities: SessionEntity[] = []
  let firstPendingToolUseId: string | null = null

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1

    const reply = await callClaudeMessages({
      systemBlocks,
      messages: loopMessages,
      tools: toolsDefs && toolsDefs.length > 0 ? toolsDefs : undefined,
      toolChoice: toolsDefs && toolsDefs.length > 0 ? { type: "auto" } : undefined,
      maxTokens: toolsDefs && toolsDefs.length > 0 ? 4096 : 2048,
      model: chooseModel("chat"),
      companyId: params.companyId,
      feature: toolsDefs && toolsDefs.length > 0 ? "ai_chat_tools" : "ai_chat",
    })

    if (reply.quotaWarning) quotaWarning = true
    if (typeof reply.tokensUsed === "number") tokensUsedTotal += reply.tokensUsed
    if (typeof reply.model === "string") modelLast = reply.model

    if (reply.error || !reply.data) {
      return {
        data: null,
        error: reply.error || "AI reply unavailable",
        quotaWarning,
        tokensUsed: tokensUsedTotal,
        model: modelLast,
      }
    }

    if (reply.data.text.trim()) responsePieces.push(reply.data.text.trim())

    const toolUses = reply.data.toolUses
    if (!toolsDefs || toolsDefs.length === 0 || toolUses.length === 0) {
      break
    }

    const assistantParts: ClaudeContentPart[] = []
    if (reply.data.text.trim()) assistantParts.push({ type: "text", text: reply.data.text.trim() })
    for (const tu of toolUses) {
      assistantParts.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input })
      mergedToolCalls.push({ id: tu.id, name: tu.name, input: tu.input })
    }
    loopMessages.push({ role: "assistant", content: assistantParts })

    const persistedRound: PersistedToolResult[] = []
    const apiToolResults: ClaudeContentPart[] = []
    let destructiveLeft = MAX_DESTRUCTIVE_PER_TURN
    let pausedForConfirmation = false

    for (const tu of toolUses) {
      const known = getToolByName(tu.name)
      const skipConfirmation = known ? !toolConfirmationRequired(known, tu.input) : false

      const outcome = await execTool({
        toolName: tu.name,
        toolInput: tu.input,
        toolUseId: tu.id,
        conversationId: params.conversationId,
        messageId: null,
        companyId: params.companyId,
        userId: params.userId,
        userRole: params.userRole,
        companyTier: params.companyTier,
        skipConfirmation,
        destructiveSlotsRemaining: destructiveLeft,
      })

      auditIdsForMessageLink.push(outcome.auditId)

      // Ledger only entities that were actually created/modified (or proposed for confirmation).
      if (
        outcome.status === "pending_confirmation" ||
        outcome.status === "executed" ||
        outcome.status === "auto_executed"
      ) {
        touchedEntities.push(...extractTouchedEntities(tu.name, tu.input, outcome))
      }

      if (outcome.status === "pending_confirmation") {
        destructiveLeft -= 1
        pausedForConfirmation = true
        if (!firstPendingToolUseId) firstPendingToolUseId = tu.id
        const summary = outcome.preview?.summary ?? "Awaiting confirmation."
        const affected = outcome.preview?.affected ?? []
        pendingConfirmations.push({
          auditId: outcome.auditId,
          toolName: tu.name,
          toolUseId: tu.id,
          summary,
          affected,
        })
        const body = JSON.stringify({
          pending_user_confirmation: true,
          audit_id: outcome.auditId,
          summary,
          affected,
        })
        persistedRound.push({ tool_use_id: tu.id, content: body })
        apiToolResults.push({ type: "tool_result", tool_use_id: tu.id, content: body })
        continue
      }

      if (outcome.status === "auto_executed" || outcome.status === "executed") {
        toolCallsExecuted.push({ name: tu.name, result: outcome.result })
        const body = JSON.stringify({ ok: true, data: outcome.result })
        persistedRound.push({ tool_use_id: tu.id, content: body })
        apiToolResults.push({ type: "tool_result", tool_use_id: tu.id, content: body })
        continue
      }

      const body = JSON.stringify({ ok: false, error: outcome.error || outcome.status })
      persistedRound.push({ tool_use_id: tu.id, content: body, is_error: true })
      apiToolResults.push({ type: "tool_result", tool_use_id: tu.id, content: body, is_error: true })
    }

    mergedToolResults.push(...persistedRound)
    loopMessages.push({ role: "user", content: apiToolResults })

    if (pausedForConfirmation) {
      break
    }
  }

  let responseText = responsePieces.join("\n\n").trim()

  // Update the session entity ledger with anything this turn's tool calls touched (best-effort).
  if (touchedEntities.length > 0) {
    const existing = await loadSessionEntities(params.companyId, params.conversationId)
    const merged = mergeSessionEntities(existing, touchedEntities)
    void persistSessionEntities(params.companyId, params.conversationId, merged)
  }

  // Post-generation numeric verification: flag monetary/large figures that don't appear in the
  // context we gave the model so hallucinated numbers don't ship silently.
  if (NUMERIC_VERIFICATION.enabled && responseText) {
    const unverified = findUnverifiedNumericClaims(responseText, systemBlocks, loopMessages)
    if (unverified.length > 0) {
      if (NUMERIC_VERIFICATION.mode === "log" || NUMERIC_VERIFICATION.mode === "both") {
        void logAiUsage({
          companyId: params.companyId,
          feature: "numeric_unverified",
          model: modelLast || "unknown",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd: 0,
          durationMs: 0,
          metadata: {
            unverified_values: unverified.map((c) => c.raw),
            user_question: params.userMessage,
            conversation_id: params.conversationId,
          },
        })
      }
      if (NUMERIC_VERIFICATION.mode === "caveat" || NUMERIC_VERIFICATION.mode === "both") {
        responseText = `${responseText}${NUMERIC_VERIFICATION.caveat}`
      }
    }
  }

  // Explainability: persist safety/compliance recommendations (HOS/CSA/inspection/HAZMAT) with the
  // relevant company context data points used to produce them.
  {
    const category = categorizeSafetyCompliance(`${params.userMessage}\n${responseText}`)
    const complianceRelated =
      category !== null ||
      used.includes("compliance") ||
      /\b(hos|csa|inspection|hazmat|hazardous|endorsement|dot|roadside)\b/i.test(params.userMessage)
    if (complianceRelated && responseText.trim()) {
      const promptHash = sha256(LOGISTICS_SYSTEM_PROMPT)
      const relevantLines = extractRelevantDataPointsFromContext(cacheContext)
      void insertExplainabilityRecord({
        companyId: params.companyId,
        source: "chat",
        category: category || "other",
        recommendation: responseText,
        dataPoints: {
          user_message: params.userMessage,
          relevant_context_lines: relevantLines,
        },
        contextUsed: used,
        model: modelLast || null,
        promptVersion: EXPLAINABILITY_PROMPT_VERSION_CHAT,
        promptHash,
        confidence: null,
        conversationId: params.conversationId,
        messageId: null,
        automationType: null,
      })
    }
  }

  // Cache only pure read-only answers: no tool calls at all (so no mutation could have occurred),
  // no pending confirmations, and a clean, non-quota-warned text answer. Best-effort, fire-and-forget.
  const isReadOnlyAnswer =
    mergedToolCalls.length === 0 && pendingConfirmations.length === 0 && !quotaWarning && responseText.trim().length > 0
  if (isReadOnlyAnswer && normalizedQuestion && !params.voiceMode) {
    void setCachedAnswer({
      companyId: params.companyId,
      cacheKey: answerCacheKey,
      question: normalizedQuestion,
      contextTypes: classification.contextTypes,
      answer: responseText,
      contextUsed: used,
    })
  }

  return {
    data: {
      responseText,
      contextUsed: used,
      toolCallsExecuted,
      pendingConfirmations,
      mergedToolCalls,
      mergedToolResults,
      firstPendingToolUseId,
      auditIdsForMessageLink,
    },
    error: null,
    tokensUsed: tokensUsedTotal,
    model: modelLast,
    quotaWarning,
  }
}

/** Continuation after pending tool rows were resolved in the database. */
export async function resumeAssistantAfterToolResolution(params: {
  companyId: string
  conversationHistory: AiChatHistoryRow[]
  enableTools: boolean
  companyTier: PlanTier
  userRole: AppRole
  remainingAiCalls: number
}): Promise<AiResponse<{ responseText: string }>> {
  const cacheContext = [
    "=== Grounding context (this company) ===",
    (await gatherContextBlocks(params.companyId, [...ALL_CONTEXT_TYPES])).text ||
      "(no structured context available for the selected domains)",
  ].join("\n")

  const toolsEligible =
    params.enableTools &&
    hasAdvancedActionsTier(params.companyTier) &&
    getAvailableTools({ userRole: params.userRole, companyTier: params.companyTier }).length > 0

  const systemBlocks = buildSystemBlocks({
    includeToolLoopGuidance: toolsEligible,
    cacheContext,
    tier: params.companyTier,
    toolsActiveThisRequest: toolsEligible,
    remainingCalls: params.remainingAiCalls,
  })

  const loopMessages = buildClaudeThread(params.conversationHistory)

  const reply = await callClaudeMessages({
    systemBlocks,
    messages: loopMessages,
    maxTokens: 2048,
    model: chooseModel("chat"),
    companyId: params.companyId,
    feature: "ai_chat_resume",
  })

  const text = reply.data?.text.trim() ?? ""
  return {
    data: reply.error ? null : { responseText: text },
    error: reply.error,
    tokensUsed: reply.tokensUsed,
    model: reply.model,
    quotaWarning: reply.quotaWarning,
  }
}
