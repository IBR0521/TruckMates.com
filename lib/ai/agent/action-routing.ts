/**
 * Deterministic trigger → handler mapping. The model must never choose action.type;
 * only triggers listed here may execute when shouldAct is true.
 */
export const TRIGGER_TO_ACTION_TYPE: Readonly<Record<string, string>> = {
  load_status_auto_update: "load_status_auto_update",
  detention_clock: "detention_clock",
  hos_violation_prevention: "hos_violation_prevention",
  driver_assignment: "driver_assignment",
  predictive_maintenance: "predictive_maintenance",
  invoice_auto_generation: "invoice_auto_generation",
  payment_followup: "payment_followup",
  credit_hold: "credit_hold",
  document_expiry_alert: "document_expiry_alert",
  csa_threshold_alert: "csa_threshold_alert",
  fuel_anomaly: "fuel_anomaly",
  idle_time_alert: "idle_time_alert",
  cash_flow_alert: "cash_flow_alert",
}

/** Autonomous level still requires human approval for messaging and money/customer mutations. */
export const REQUIRES_HUMAN_APPROVAL = new Set<string>([
  "payment_followup",
  "hos_violation_prevention",
  "idle_time_alert",
  "credit_hold",
  "invoice_auto_generation",
])

export function resolveActionTypeForTrigger(trigger: string): string | null {
  return TRIGGER_TO_ACTION_TYPE[trigger] ?? null
}

export function requiresHumanApprovalForAutonomous(actionType: string): boolean {
  return REQUIRES_HUMAN_APPROVAL.has(actionType)
}
