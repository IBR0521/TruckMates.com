/** Briefing-sourced proactive actions must never auto-run without explicit user confirmation. */
export function proactiveRecommendationForceConfirmation(alertType: string, toolName: string): boolean {
  return alertType === "morning_briefing_recommendation" && toolName === "update_load_status"
}
