import { callClaude } from "@/lib/ai/client"
import {
  getComplianceContext,
  getDriverContext,
  getFinancialContext,
  getFleetContext,
  getLoadContext,
  getMaintenanceContext,
} from "@/lib/ai/context"
import { executeAgentAction } from "@/lib/ai/agent/executor"
import {
  requiresHumanApprovalForAutonomous,
  resolveActionTypeForTrigger,
} from "@/lib/ai/agent/action-routing"
import { extractDedupFingerprint, fingerprintsOverlap } from "@/lib/ai/agent/dedup-fingerprints"
import { createPendingApproval, getAutomationConfig, logAutomationEvent } from "@/lib/ai/agent/settings"
import { chooseAgentDecisionModel } from "@/lib/ai/model-router"
import { createAdminClient } from "@/lib/supabase/admin"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import { sendPushToCompanyRoles } from "@/app/actions/push-notifications"
import type { AgentAction, AgentDecision, AutomationLevel } from "@/lib/ai/types"
import {
  categorizeSafetyCompliance,
  EXPLAINABILITY_PROMPT_VERSION_AGENT,
  insertExplainabilityRecord,
  sha256,
} from "@/lib/ai/explainability"

type ContextType = "fleet" | "driver" | "load" | "financial" | "compliance" | "maintenance"

/**
 * De-duplication cooldown for agent evaluations. If the same automation already took an action (or
 * created a pending approval) for the same entity within this window, we skip re-evaluating to avoid
 * duplicate actions and wasted model calls. Tune here.
 */
const AGENT_DEDUP_COOLDOWN_MINUTES = 60

type RunAgentEvaluationParams = {
  companyId: string
  trigger: string
  triggerData: Record<string, unknown>
  contextTypes: ContextType[]
}

type AiDecisionPayload = {
  shouldAct?: unknown
  confidence?: unknown
  reasoning?: unknown
  suggestedAction?: unknown
  actionPayload?: unknown
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function toString(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim()
  return text || fallback
}

function clampConfidence(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function normalizeDecision(data: unknown): {
  shouldAct: boolean
  confidence: number
  reasoning: string
  suggestedAction: string
  actionPayload: Record<string, unknown>
} {
  const payload = toRecord(data) as AiDecisionPayload
  return {
    shouldAct: toBoolean(payload.shouldAct, false),
    confidence: clampConfidence(payload.confidence, 0),
    reasoning: toString(payload.reasoning, "No reasoning provided."),
    suggestedAction: toString(payload.suggestedAction, ""),
    actionPayload: toRecord(payload.actionPayload),
  }
}

async function assembleContext(
  companyId: string,
  contextTypes: ContextType[],
  triggerData: Record<string, unknown>
): Promise<string> {
  const driverId = toString(triggerData.driverId || triggerData.driver_id || "")
  const loadId = toString(triggerData.loadId || triggerData.load_id || "")
  const truckId = toString(triggerData.truckId || triggerData.truck_id || "")

  const contextMap: Record<ContextType, Promise<string>> = {
    fleet: getFleetContext(companyId),
    driver: getDriverContext(companyId, driverId || undefined),
    load: getLoadContext(companyId, loadId || undefined),
    financial: getFinancialContext(companyId),
    compliance: getComplianceContext(companyId),
    maintenance: getMaintenanceContext(companyId, truckId || undefined),
  }

  const requested: ContextType[] =
    contextTypes.length > 0 ? contextTypes : ["fleet", "financial", "compliance"]
  const contextBlocks = await Promise.all(requested.map((key) => contextMap[key]))
  return contextBlocks.filter(Boolean).join("\n\n")
}

/**
 * Look for a recent automation event for the same company + automation type that already resulted in
 * an action taken or pending approval (triggered = true) for the same entity, within the cooldown
 * window. Returns the matching log id + timestamp, or null. Read errors are non-fatal (return null)
 * so the guard can never block legitimate evaluations.
 */
async function findRecentDuplicateEvent(params: {
  companyId: string
  automationType: string
  currentEntities: Record<string, string>
  cooldownMinutes: number
}): Promise<{ id: string; createdAt: string } | null> {
  try {
    const cutoff = new Date(Date.now() - params.cooldownMinutes * 60 * 1000).toISOString()
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("ai_automation_logs")
      .select("id, action_payload, created_at")
      .eq("company_id", params.companyId)
      .eq("automation_type", params.automationType)
      .eq("triggered", true)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !data) return null

    for (const row of data as Array<{ id: string; action_payload: Record<string, unknown> | null; created_at: string }>) {
      const payload = row.action_payload || {}
      const rowTrigger =
        payload.triggerData && typeof payload.triggerData === "object" && !Array.isArray(payload.triggerData)
          ? (payload.triggerData as Record<string, unknown>)
          : {}
      const rowFingerprint = extractDedupFingerprint(params.automationType, rowTrigger)
      if (fingerprintsOverlap(params.currentEntities, rowFingerprint)) {
        return { id: String(row.id), createdAt: String(row.created_at) }
      }
    }

    return null
  } catch {
    return null
  }
}

function buildFallbackDecision(reasoning: string): AgentDecision {
  return {
    shouldAct: false,
    action: null,
    confidence: 0,
    reasoning,
  }
}

async function submitAgentPendingApproval(params: {
  companyId: string
  trigger: string
  logLevel: AutomationLevel
  decision: AgentDecision
  triggerData: Record<string, unknown>
  descriptionSuffix?: string
  extraActionPayload?: Record<string, unknown>
}): Promise<string | null> {
  const action = params.decision.action
  if (!action) return null

  const approvalResult = await createPendingApproval({
    companyId: params.companyId,
    automationType: params.trigger,
    description: `${action.type}: ${params.decision.reasoning}${params.descriptionSuffix ?? ""}`,
    confidence: params.decision.confidence,
    reasoning: params.decision.reasoning,
    actionPayload: {
      action,
      trigger: params.trigger,
      triggerData: params.triggerData,
    },
  })

  const approvalId = approvalResult.data?.id || null

  await sendPushToCompanyRoles(params.companyId, ["operations_manager"], {
    title: "AI action awaiting approval",
    body: params.decision.reasoning,
    data: {
      type: "ai_pending_approval",
      approvalId: approvalId || "",
      // Deep-link to the in-app approvals screen (which POSTs to /api/ai/approve).
      // Do NOT point at the API route: it is POST + auth + JSON-body only, so a
      // notification GET like `/api/ai/approve?approved=true` would 405 and mutate nothing.
      link: "/dashboard/settings/ai-automation/pending-approvals",
    },
  })

  await logAutomationEvent({
    companyId: params.companyId,
    automationType: params.trigger,
    level: params.logLevel,
    triggered: true,
    confidence: params.decision.confidence,
    reasoning: params.decision.reasoning,
    actionTaken: "pending_approval",
    actionPayload: {
      action,
      approvalId,
      triggerData: params.triggerData,
      ...params.extraActionPayload,
    },
    approved: null,
    reversedAt: null,
  })

  return approvalId
}

export async function runAgentEvaluation(params: RunAgentEvaluationParams): Promise<{
  decision: AgentDecision
  executed: boolean
  pendingApprovalId: string | null
}> {
  const configResult = await getAutomationConfig(params.companyId, params.trigger)
  if (configResult.error || !configResult.data) {
    const decision = buildFallbackDecision(configResult.error || "Automation config unavailable")
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: "off",
      triggered: false,
      confidence: 0,
      reasoning: decision.reasoning,
      actionTaken: null,
      actionPayload: { triggerData: params.triggerData },
      approved: null,
      reversedAt: null,
    })
    return { decision, executed: false, pendingApprovalId: null }
  }

  const config = configResult.data
  if (!config.enabled) {
    const decision = buildFallbackDecision(`Automation '${params.trigger}' is disabled.`)
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: false,
      confidence: 0,
      reasoning: decision.reasoning,
      actionTaken: null,
      actionPayload: { triggerData: params.triggerData },
      approved: null,
      reversedAt: null,
    })
    return { decision, executed: false, pendingApprovalId: null }
  }

  // De-duplication guard: skip when the same entity or fingerprint already triggered an action
  // or pending approval within the cooldown window.
  const dedupFingerprint = extractDedupFingerprint(params.trigger, params.triggerData)
  if (Object.keys(dedupFingerprint).length > 0) {
    const duplicate = await findRecentDuplicateEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      currentEntities: dedupFingerprint,
      cooldownMinutes: AGENT_DEDUP_COOLDOWN_MINUTES,
    })

    if (duplicate) {
      const fingerprintSummary = Object.entries(dedupFingerprint)
        .map(([type, id]) => `${type} ${id}`)
        .join(", ")
      const reasoning = `Skipped: a '${params.trigger}' action for ${fingerprintSummary} was already taken or is pending within the last ${AGENT_DEDUP_COOLDOWN_MINUTES} minutes (cooldown).`
      const decision = buildFallbackDecision(reasoning)
      await logAutomationEvent({
        companyId: params.companyId,
        automationType: params.trigger,
        level: config.level,
        triggered: false,
        confidence: 0,
        reasoning,
        actionTaken: "skipped_cooldown",
        actionPayload: {
          triggerData: params.triggerData,
          cooldownMinutes: AGENT_DEDUP_COOLDOWN_MINUTES,
          duplicateOfLogId: duplicate.id,
          duplicateEventAt: duplicate.createdAt,
        },
        approved: null,
        reversedAt: null,
      })
      return { decision, executed: false, pendingApprovalId: null }
    }
  }

  const assembledContext = await assembleContext(params.companyId, params.contextTypes, params.triggerData)
  const decisionPrompt = [
    "Evaluate the event and decide whether TruckMates AI should take action.",
    "",
    "Company context:",
    assembledContext || "No additional context available.",
    "",
    `Trigger: ${params.trigger}`,
    `Trigger data: ${JSON.stringify(params.triggerData)}`,
    "",
    "Return JSON only with this exact shape:",
    "{",
    '  "shouldAct": boolean,',
    '  "confidence": number,',
    '  "reasoning": string,',
    '  "actionPayload": { "any": "object" }',
    "}",
    "",
    "Do not choose or name an action type — the handler is fixed by the trigger. Only supply parameters in actionPayload.",
  ].join("\n")

  const aiResponse = await callClaude<AiDecisionPayload>(LOGISTICS_SYSTEM_PROMPT, decisionPrompt, {
    expectJson: true,
    maxTokens: 800,
    model: chooseAgentDecisionModel(params.trigger),
    feature: `agent_${params.trigger}`,
    companyId: params.companyId,
    cacheSystemPrompt: true,
  })

  if (aiResponse.error || !aiResponse.data) {
    const decision = buildFallbackDecision(aiResponse.error || "AI decision unavailable")
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: false,
      confidence: 0,
      reasoning: decision.reasoning,
      actionTaken: null,
      actionPayload: {
        triggerData: params.triggerData,
        context: assembledContext,
      },
      approved: null,
      reversedAt: null,
    })
    return { decision, executed: false, pendingApprovalId: null }
  }

  const normalized = normalizeDecision(aiResponse.data)
  let shouldAct = normalized.shouldAct

  if (normalized.confidence < config.confidenceThreshold) {
    shouldAct = false
  }

  const resolvedActionType = resolveActionTypeForTrigger(params.trigger)

  if (shouldAct && !resolvedActionType) {
    const reasoning = `Skipped: trigger '${params.trigger}' has no mapped handler.`
    const decision = buildFallbackDecision(reasoning)
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: false,
      confidence: normalized.confidence,
      reasoning,
      actionTaken: "skipped_unmapped_trigger",
      actionPayload: {
        triggerData: params.triggerData,
        context: assembledContext,
        suggestedAction: normalized.suggestedAction || null,
      },
      approved: null,
      reversedAt: null,
    })
    return { decision, executed: false, pendingApprovalId: null }
  }

  const action: AgentAction | null =
    shouldAct && resolvedActionType
      ? {
          type: resolvedActionType,
          companyId: params.companyId,
          triggeredBy: params.trigger,
          payload: { ...toRecord(params.triggerData), ...normalized.actionPayload },
          confidence: normalized.confidence,
          reasoning: normalized.reasoning,
          automationLevel: config.level,
          reversible: toBoolean(normalized.actionPayload.reversible, true),
        }
      : null

  const decision: AgentDecision = {
    shouldAct,
    action,
    confidence: normalized.confidence,
    reasoning:
      normalized.confidence < config.confidenceThreshold
        ? `${normalized.reasoning} Confidence below threshold (${config.confidenceThreshold}).`
        : normalized.reasoning,
  }

  // Explainability: persist safety/compliance recommendations for relevant triggers so they are
  // reconstructable later. Store only this company's data points (triggerData + assembledContext).
  {
    const category =
      categorizeSafetyCompliance(`${params.trigger}\n${decision.reasoning}`) ||
      (params.trigger.includes("hos") ? "hos" : params.trigger.includes("csa") ? "csa" : null)
    const shouldLog =
      category !== null ||
      params.trigger === "hos_violation_prevention" ||
      params.trigger === "csa_threshold_alert" ||
      params.trigger === "document_expiry_alert"
    if (shouldLog) {
      void insertExplainabilityRecord({
        companyId: params.companyId,
        source: "agent",
        category: category || "other",
        recommendation: decision.reasoning,
        dataPoints: {
          trigger: params.trigger,
          triggerData: params.triggerData,
          contextTypes: params.contextTypes,
          context: assembledContext,
        },
        contextUsed: params.contextTypes,
        model: aiResponse.model || null,
        promptVersion: EXPLAINABILITY_PROMPT_VERSION_AGENT,
        promptHash: sha256(LOGISTICS_SYSTEM_PROMPT),
        confidence: Number.isFinite(decision.confidence) ? decision.confidence / 100 : null,
        conversationId: null,
        messageId: null,
        automationType: params.trigger,
      })
    }
  }

  if (!decision.shouldAct || !decision.action) {
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: false,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      actionTaken: null,
      actionPayload: {
        triggerData: params.triggerData,
        context: assembledContext,
        suggestedAction: normalized.suggestedAction,
      },
      approved: null,
      reversedAt: null,
    })
    return { decision, executed: false, pendingApprovalId: null }
  }

  if (config.level === "off") {
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: false,
      confidence: decision.confidence,
      reasoning: `${decision.reasoning} Automation level is off.`,
      actionTaken: null,
      actionPayload: { action: decision.action, triggerData: params.triggerData },
      approved: null,
      reversedAt: null,
    })
    return { decision: { ...decision, shouldAct: false, action: null }, executed: false, pendingApprovalId: null }
  }

  if (config.level === "notify") {
    await sendPushToCompanyRoles(params.companyId, ["operations_manager", "dispatcher"], {
      title: "TruckMates AI Notification",
      body: decision.reasoning,
      data: {
        type: "ai_notify",
        trigger: params.trigger,
      },
    })

    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: true,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      actionTaken: "notification_only",
      actionPayload: { action: decision.action, triggerData: params.triggerData },
      approved: null,
      reversedAt: null,
    })

    return { decision, executed: false, pendingApprovalId: null }
  }

  if (config.level === "approval") {
    const approvalId = await submitAgentPendingApproval({
      companyId: params.companyId,
      trigger: params.trigger,
      logLevel: config.level,
      decision,
      triggerData: params.triggerData,
    })

    return { decision, executed: false, pendingApprovalId: approvalId }
  }

  if (config.level === "autonomous") {
    const { checkFeatureAccess } = await import("@/lib/plan-enforcement")
    const { allowed } = await checkFeatureAccess({ companyId: params.companyId, feature: "ai_autonomous_agent" })
    if (!allowed) {
      const approvalId = await submitAgentPendingApproval({
        companyId: params.companyId,
        trigger: params.trigger,
        logLevel: "approval",
        decision,
        triggerData: params.triggerData,
        descriptionSuffix: " (autonomous requires Professional+)",
        extraActionPayload: { downgradedFromAutonomous: true },
      })
      return { decision, executed: false, pendingApprovalId: approvalId }
    }

    if (requiresHumanApprovalForAutonomous(decision.action.type)) {
      const approvalId = await submitAgentPendingApproval({
        companyId: params.companyId,
        trigger: params.trigger,
        logLevel: config.level,
        decision,
        triggerData: params.triggerData,
        extraActionPayload: { forcedApprovalReason: "messaging_or_money" },
      })
      return { decision, executed: false, pendingApprovalId: approvalId }
    }
  }

  // Defense in depth: only the autonomous level may auto-execute. off/notify/approval all return
  // earlier, so reaching here at another level should be impossible — but guard explicitly so a
  // future level (or a reordering above) can never silently fall through into autonomous execution
  // of money/messaging actions.
  if (config.level !== "autonomous") {
    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: false,
      confidence: decision.confidence,
      reasoning: `${decision.reasoning} Skipped auto-execution: level '${config.level}' is not autonomous.`,
      actionTaken: "skipped_non_autonomous",
      actionPayload: { action: decision.action, triggerData: params.triggerData },
      approved: null,
      reversedAt: null,
    })
    return { decision: { ...decision, shouldAct: false, action: null }, executed: false, pendingApprovalId: null }
  }

  const execution = await executeAgentAction(decision.action)
  await logAutomationEvent({
    companyId: params.companyId,
    automationType: params.trigger,
    level: config.level,
    triggered: execution.success,
    confidence: decision.confidence,
    reasoning: execution.success ? decision.reasoning : `${decision.reasoning}\nExecution error: ${execution.error}`,
    actionTaken: execution.success ? decision.action.type : null,
    actionPayload: {
      action: decision.action,
      triggerData: params.triggerData,
      executionResult: execution.result,
      executionError: execution.error,
    },
    approved: true,
    reversedAt: null,
  })

  return { decision, executed: execution.success, pendingApprovalId: null }
}
