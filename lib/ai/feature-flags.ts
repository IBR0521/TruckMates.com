/** True when `AI_DISPATCH_PLANNER_EXPERIMENTAL` is set to a truthy value. */
export function isAiDispatchPlannerExperimentalEnabled(): boolean {
  const v = String(process.env.AI_DISPATCH_PLANNER_EXPERIMENTAL || "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

/** True when `AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS` is set to a truthy value. */
export function isAiBriefingActionableRecommendationsEnabled(): boolean {
  const v = String(process.env.AI_BRIEFING_ACTIONABLE_RECOMMENDATIONS || "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}
