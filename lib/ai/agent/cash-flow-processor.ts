import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateCashFlowTier0,
  resolveCashFlowProjectionThreshold,
  tier2CashFlowAiNarrativeHook,
} from "@/lib/ai/agent/cash-flow-gate"
import { gatherCashFlowTriggerData } from "@/lib/ai/agent/cash-flow-trigger"
import { dispatchDeterministicCashFlowAlert } from "@/lib/ai/agent/executor"
import {
  expireStalePendingApprovals,
  getAutomationConfigAdmin,
  logAutomationEvent,
} from "@/lib/ai/agent/settings"

export type CashFlowProcessResult = {
  companyId: string
  skipped: boolean
  alerted: boolean
  reason: string
}

function extractPreviousProjection(actionPayload: Record<string, unknown> | null): number | null {
  const payload = actionPayload || {}
  const triggerData =
    payload.triggerData && typeof payload.triggerData === "object" && !Array.isArray(payload.triggerData)
      ? (payload.triggerData as Record<string, unknown>)
      : payload
  const value = Number(triggerData.projectedCashPosition14Days ?? triggerData.projected_cash_position_14_days)
  return Number.isFinite(value) ? value : null
}

async function loadPreviousProjection(
  admin: SupabaseClient,
  companyId: string,
): Promise<number | null> {
  const { data } = await admin
    .from("ai_automation_logs")
    .select("action_payload")
    .eq("company_id", companyId)
    .eq("automation_type", "cash_flow_alert")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return extractPreviousProjection((data as { action_payload: Record<string, unknown> | null }).action_payload)
}

/** Process one company through Tier 0 → Tier 1 (deterministic alert). No AI calls. */
export async function processCashFlowAlertForCompany(
  admin: SupabaseClient,
  companyId: string,
): Promise<CashFlowProcessResult> {
  const configResult = await getAutomationConfigAdmin(companyId, "cash_flow_alert")
  if (configResult.error || !configResult.data) {
    return { companyId, skipped: true, alerted: false, reason: configResult.error || "Config unavailable" }
  }

  const config = configResult.data
  if (!config.enabled || config.level === "off") {
    return {
      companyId,
      skipped: true,
      alerted: false,
      reason: config.enabled ? "Automation level is off." : "Cash flow alert is disabled.",
    }
  }

  const triggerData = await gatherCashFlowTriggerData(admin, companyId, config.config)
  const projectionThresholdUsd = resolveCashFlowProjectionThreshold(config.config)
  const previousProjection = await loadPreviousProjection(admin, companyId)

  const tier0 = evaluateCashFlowTier0(triggerData, {
    projectionThresholdUsd,
    previousProjection,
  })

  if (!tier0.shouldAct) {
    await logAutomationEvent({
      companyId,
      automationType: "cash_flow_alert",
      level: config.level,
      triggered: false,
      confidence: 0,
      reasoning: tier0.reason,
      actionTaken: "skipped_tier0",
      actionPayload: {
        triggerData,
        tier0: { triggers: tier0.triggers, projectionThresholdUsd, previousProjection },
      },
      approved: null,
      reversedAt: null,
    })
    return { companyId, skipped: true, alerted: false, reason: tier0.reason }
  }

  tier2CashFlowAiNarrativeHook({ companyId, metrics: triggerData, tier0 })

  const dispatch = await dispatchDeterministicCashFlowAlert({
    companyId,
    triggerData,
    reasoning: tier0.reason,
    level: config.level,
    tier0Triggers: tier0.triggers,
  })

  return {
    companyId,
    skipped: false,
    alerted: dispatch.success,
    reason: dispatch.success ? tier0.reason : dispatch.error || "Alert dispatch failed",
  }
}

/** Morning-digest batch: deterministic cash-flow checks for all companies. */
export async function runCashFlowAlertBatch(admin: SupabaseClient): Promise<{
  processed: number
  skipped: number
  alerted: number
  expiredPendingApprovals: number
}> {
  const expiredPendingApprovals = await expireStalePendingApprovals("cash_flow_alert")

  const { data: companies } = await admin.from("companies").select("id").limit(2000)
  let processed = 0
  let skipped = 0
  let alerted = 0

  for (const company of companies || []) {
    const companyId = String(company.id || "")
    if (!companyId) continue
    processed += 1
    const result = await processCashFlowAlertForCompany(admin, companyId)
    if (result.skipped) skipped += 1
    if (result.alerted) alerted += 1
  }

  return { processed, skipped, alerted, expiredPendingApprovals }
}
