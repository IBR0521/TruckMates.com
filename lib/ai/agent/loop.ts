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
import { createPendingApproval, getAutomationConfig, logAutomationEvent } from "@/lib/ai/agent/settings"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import { sendPushToCompanyRoles } from "@/app/actions/push-notifications"
import type { AgentAction, AgentDecision } from "@/lib/ai/types"

type ContextType = "fleet" | "driver" | "load" | "financial" | "compliance" | "maintenance"

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

function buildFallbackDecision(reasoning: string): AgentDecision {
  return {
    shouldAct: false,
    action: null,
    confidence: 0,
    reasoning,
  }
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
    '  "suggestedAction": string,',
    '  "actionPayload": { "any": "object" }',
    "}",
  ].join("\n")

  const aiResponse = await callClaude<AiDecisionPayload>(LOGISTICS_SYSTEM_PROMPT, decisionPrompt, {
    expectJson: true,
    maxTokens: 800,
    model: "sonnet",
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

  const action: AgentAction | null = shouldAct
    ? {
        type: normalized.suggestedAction || params.trigger,
        companyId: params.companyId,
        triggeredBy: params.trigger,
        payload: normalized.actionPayload,
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
    const approvalResult = await createPendingApproval({
      companyId: params.companyId,
      automationType: params.trigger,
      description: `${decision.action.type}: ${decision.reasoning}`,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      actionPayload: {
        action: decision.action,
        trigger: params.trigger,
        triggerData: params.triggerData,
      },
    })

    const approvalId = approvalResult.data?.id || null

    await sendPushToCompanyRoles(params.companyId, ["operations_manager"], {
      title: "AI action awaiting approval",
      body: decision.reasoning,
      data: {
        type: "ai_pending_approval",
        approvalId: approvalId || "",
        approveUrl: `/api/ai/approve?approvalId=${approvalId || ""}&approved=true`,
        rejectUrl: `/api/ai/approve?approvalId=${approvalId || ""}&approved=false`,
      },
    })

    await logAutomationEvent({
      companyId: params.companyId,
      automationType: params.trigger,
      level: config.level,
      triggered: true,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      actionTaken: "pending_approval",
      actionPayload: {
        action: decision.action,
        approvalId,
        triggerData: params.triggerData,
      },
      approved: null,
      reversedAt: null,
    })

    return { decision, executed: false, pendingApprovalId: approvalId }
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
