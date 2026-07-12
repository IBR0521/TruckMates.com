import type { AutomationLevel } from "@/lib/ai/types"

/**
 * Autonomy presets — the "one-click autopilot" backing logic.
 *
 * Instead of configuring ~16 automations one by one, a manager picks how much to hand over and this
 * maps every automation to a coherent level:
 *   • manual    — everything on "notify": the AI still watches and surfaces what it sees, but never acts.
 *   • assisted  — safe operational automations run themselves; anything touching money, a customer, or
 *                 an outbound message stays "approval" so a human signs off. (Recommended default.)
 *   • autopilot — everything autonomous. Note the executor STILL hard-gates money/messaging actions to
 *                 human approval at runtime (REQUIRES_HUMAN_APPROVAL), so "autopilot" is bold but not reckless.
 */
export type AutonomyPreset = "manual" | "assisted" | "autopilot"

export const AUTONOMY_PRESETS: AutonomyPreset[] = ["manual", "assisted", "autopilot"]

// Automations that touch money, a customer relationship, or send an outbound message — held at
// "approval" under the Assisted preset so a person confirms before it happens.
const NEEDS_REVIEW = new Set<string>([
  "invoice_auto_generation",
  "payment_followup",
  "credit_hold",
  "driver_assignment",
  "backhaul_matching",
  "churn_risk",
])

export function levelForPreset(automationType: string, preset: AutonomyPreset): AutomationLevel {
  if (preset === "manual") return "notify"
  if (preset === "autopilot") return "autonomous"
  // assisted
  return NEEDS_REVIEW.has(automationType) ? "approval" : "autonomous"
}

export function isAutonomyPreset(value: unknown): value is AutonomyPreset {
  return value === "manual" || value === "assisted" || value === "autopilot"
}
