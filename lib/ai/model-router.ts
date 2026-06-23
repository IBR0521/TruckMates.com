import type { AiModel } from "@/lib/ai/types"

/**
 * Task-complexity model routing.
 *
 * Central place that maps a logical task to the model we run it on, so call sites never hardcode
 * model strings. Today we only have two tiers (haiku, sonnet):
 * - "classify": trivial JSON labeling — cheap/fast haiku is plenty.
 * - "chat" / "agent_decision" / "analysis": reasoning over company context — sonnet.
 *
 * NOTE: genuinely hard multi-entity reasoning (e.g. cross-load optimization, multi-driver HOS
 * planning, large analytical synthesis) can later be routed to a stronger model when one is
 * configured — add an "opus"-class entry to AiModel/MODEL_MAP and return it here for the relevant
 * task(s). Routing only here means that upgrade is a one-line change with no call-site churn.
 */
export type AiTask = "classify" | "chat" | "agent_decision" | "analysis"

const TASK_MODEL: Record<AiTask, AiModel> = {
  classify: "haiku",
  chat: "sonnet",
  agent_decision: "sonnet",
  analysis: "sonnet",
}

export function chooseModel(task: AiTask): AiModel {
  return TASK_MODEL[task]
}

/** Agent loop model routing; cash_flow_alert uses haiku after deterministic pre-check escalation. */
export function chooseAgentDecisionModel(trigger: string): AiModel {
  if (trigger === "cash_flow_alert") return "haiku"
  return TASK_MODEL.agent_decision
}
