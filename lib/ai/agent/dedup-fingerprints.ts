import { cashFlowSnapshotFingerprint } from "@/lib/ai/agent/cash-flow-gate"

/**
 * Canonical identifiers used for AGENT_DEDUP_COOLDOWN_MINUTES matching in loop.ts.
 * Accepts camelCase and snake_case variants found in trigger payloads.
 */
export const DEDUP_ENTITY_KEYS: ReadonlyArray<{
  canonical: "driver" | "load" | "truck" | "customer" | "invoice"
  keys: readonly string[]
}> = [
  { canonical: "driver", keys: ["driverId", "driver_id"] },
  { canonical: "load", keys: ["loadId", "load_id"] },
  { canonical: "truck", keys: ["truckId", "truck_id"] },
  { canonical: "customer", keys: ["customerId", "customer_id"] },
  { canonical: "invoice", keys: ["invoiceId", "invoice_id"] },
]

function toString(value: unknown): string {
  return String(value ?? "").trim()
}

/** Entity ids present in trigger data (driver/load/truck/customer/invoice). */
export function extractEntityIds(triggerData: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { canonical, keys } of DEDUP_ENTITY_KEYS) {
    for (const key of keys) {
      const value = toString(triggerData[key] || "")
      if (value) {
        out[canonical] = value
        break
      }
    }
  }
  return out
}

/** 5-point CSA score bucket — same company/category won't refire until score moves to a new bucket. */
export function csaScoreBucketFingerprint(category: string, score: number): Record<string, string> {
  const normalizedCategory = toString(category)
  if (!normalizedCategory || !Number.isFinite(score)) return {}
  const bucket = Math.floor(score / 5) * 5
  return { csa: `${normalizedCategory}:${bucket}` }
}

/**
 * Entity ids when present; otherwise a trigger-specific fingerprint for entity-less automations.
 * Returns {} only when no dedup key can be derived (cooldown cannot apply).
 *
 * companyId is scoped by findRecentDuplicateEvent in loop.ts and is not part of the fingerprint.
 */
export function extractDedupFingerprint(
  trigger: string,
  triggerData: Record<string, unknown>,
): Record<string, string> {
  // Per-trigger entity selection (invoice/customer only — avoid cross-entity false positives).
  if (trigger === "payment_followup") {
    const invoiceId = toString(triggerData.invoiceId || triggerData.invoice_id)
    if (invoiceId) return { invoice: invoiceId }
  }

  if (trigger === "credit_hold") {
    const customerId = toString(triggerData.customerId || triggerData.customer_id)
    if (customerId) return { customer: customerId }
  }

  const entities = extractEntityIds(triggerData)
  if (Object.keys(entities).length > 0) return entities

  switch (trigger) {
    case "cash_flow_alert":
      return cashFlowSnapshotFingerprint({
        projectedCashPosition14Days: Number(triggerData.projectedCashPosition14Days ?? 0),
        totalArOutstanding: Number(triggerData.totalArOutstanding ?? 0),
        upcomingSettlementsTotal: Number(triggerData.upcomingSettlementsTotal ?? 0),
      })

    case "csa_threshold_alert":
      return csaScoreBucketFingerprint(
        toString(triggerData.basicCategory || triggerData.basic_category),
        Number(triggerData.score),
      )

    case "fuel_anomaly": {
      const transactionId = toString(triggerData.transactionId || triggerData.transaction_id)
      if (transactionId) return { transaction: transactionId }
      return {}
    }

    default:
      return {}
  }
}

/** True when two fingerprint maps share at least one identical (key, value) pair. */
export function fingerprintsOverlap(a: Record<string, string>, b: Record<string, string>): boolean {
  return Object.keys(a).some((key) => Boolean(a[key]) && a[key] === b[key])
}
