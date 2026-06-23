/**
 * Tier 0 deterministic logic for cash_flow_alert (no AI).
 *
 * Default projection threshold ($10,000) derived from production trigger payloads
 * (Jun 1–20, 2026): all AI-triggered tight-position cases were $3,810–$11,820;
 * healthy active company sat at $12,006 with no trigger.
 *
 * Per-company override: ai_automation_configs.config.projectionThresholdUsd
 */
export const CASH_FLOW_TIER0 = {
  /** Skip when both AR and pending settlements are zero. */
  minActivityUsd: 0.01,

  /** Platform default when company has no custom projectionThresholdUsd. */
  defaultProjectionThresholdUsd: 10_000,

  /** Re-fire when projection moves more than this fraction vs. last logged snapshot. */
  materialChangeRatio: 0.1,

  /** Config key in ai_automation_configs.config for per-company threshold override. */
  projectionThresholdConfigKey: "projectionThresholdUsd",

  /** Legacy AI path cooldown (Tier 2 only — unused while cron is deterministic). */
  aiEvaluationCooldownHours: 24,
} as const

export type CashFlowTriggerMetrics = {
  projectedCashPosition14Days: number
  totalArOutstanding: number
  upcomingSettlementsTotal: number
  configuredThreshold?: number
}

export type CashFlowTier0Result = {
  shouldAct: boolean
  reason: string
  triggers: string[]
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100
}

export function hasCashFlowActivity(metrics: CashFlowTriggerMetrics): boolean {
  return (
    metrics.totalArOutstanding >= CASH_FLOW_TIER0.minActivityUsd ||
    metrics.upcomingSettlementsTotal >= CASH_FLOW_TIER0.minActivityUsd
  )
}

/** Read per-company threshold from automation config, falling back to platform default. */
export function resolveCashFlowProjectionThreshold(
  config: Record<string, unknown> | null | undefined,
): number {
  const raw = config?.[CASH_FLOW_TIER0.projectionThresholdConfigKey]
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed >= 0) return parsed
  return CASH_FLOW_TIER0.defaultProjectionThresholdUsd
}

function crossedZero(previous: number, current: number): boolean {
  return (previous >= 0 && current < 0) || (previous < 0 && current >= 0)
}

function materialChange(previous: number, current: number): boolean {
  const baseline = Math.max(Math.abs(previous), 1)
  return Math.abs(current - previous) / baseline > CASH_FLOW_TIER0.materialChangeRatio
}

/**
 * Tier 0 gate: should this snapshot proceed to Tier 1 (direct alert)?
 * Requires financial activity plus either sub-threshold projection or material movement.
 */
export function evaluateCashFlowTier0(
  metrics: CashFlowTriggerMetrics,
  options?: {
    projectionThresholdUsd?: number
    previousProjection?: number | null
  },
): CashFlowTier0Result {
  const projection = roundUsd(metrics.projectedCashPosition14Days)
  const ar = roundUsd(metrics.totalArOutstanding)
  const settlements = roundUsd(metrics.upcomingSettlementsTotal)
  const threshold = options?.projectionThresholdUsd ?? CASH_FLOW_TIER0.defaultProjectionThresholdUsd
  const previousProjection =
    options?.previousProjection === null || options?.previousProjection === undefined
      ? null
      : roundUsd(options.previousProjection)

  if (!hasCashFlowActivity(metrics)) {
    return {
      shouldAct: false,
      reason: `No AR or pending settlements (AR $${ar.toFixed(2)}, settlements $${settlements.toFixed(2)}).`,
      triggers: [],
    }
  }

  const triggers: string[] = []

  if (projection < threshold) {
    triggers.push(`projection_below_threshold:${projection}<${threshold}`)
  }

  if (previousProjection !== null) {
    if (crossedZero(previousProjection, projection)) {
      triggers.push(`crossed_zero:${previousProjection}_to_${projection}`)
    } else if (materialChange(previousProjection, projection)) {
      triggers.push(`material_change:${previousProjection}_to_${projection}`)
    }
  }

  if (triggers.length === 0) {
    return {
      shouldAct: false,
      reason: `Projected position $${projection.toFixed(2)} above threshold $${threshold.toLocaleString()} with no material change since last check.`,
      triggers: [],
    }
  }

  return {
    shouldAct: true,
    reason: `Tier 0 triggered (${triggers.join(", ")}). Projection $${projection.toFixed(2)}, threshold $${threshold.toLocaleString()}, AR $${ar.toFixed(2)}, settlements $${settlements.toFixed(2)}.`,
    triggers,
  }
}

/** Stable fingerprint for alert dedup / future Tier 2 event hooks. */
export function cashFlowSnapshotFingerprint(metrics: CashFlowTriggerMetrics): Record<string, string> {
  const projection = Number(metrics.projectedCashPosition14Days || 0)
  const ar = Number(metrics.totalArOutstanding || 0)
  return {
    cash_flow: `${Math.round(projection / 1000)}:${Math.round(ar / 1000)}`,
  }
}

/**
 * TIER 2 hook (not implemented): future event-driven AI narrative step.
 * Call here when Tier 0 fires if/when AI nuance is reintroduced outside daily cron.
 */
export function tier2CashFlowAiNarrativeHook(_params: {
  companyId: string
  metrics: CashFlowTriggerMetrics
  tier0: CashFlowTier0Result
}): void {
  // Intentionally empty — measure Tier 0/1 in production before enabling AI narrative.
}
