import type { OperationsWorkflowSettings } from "./load-workflow-settings"

export type DispatchAssignmentSettings = {
  driver_assignment_method?: string | null
  consider_driver_proximity?: boolean | null
  consider_driver_experience?: boolean | null
  max_assignment_distance?: number | null
}

export type CompanyAutoAssignSettings = OperationsWorkflowSettings & DispatchAssignmentSettings

/** Merge Load + Dispatch assignment settings into one effective auto-assign config. */
export function resolveEffectiveAutoAssignSettings(
  raw: CompanyAutoAssignSettings | null | undefined,
): OperationsWorkflowSettings {
  if (!raw) return {}

  const method = String(raw.driver_assignment_method || "").toLowerCase()
  let assignment_priority = raw.assignment_priority || "proximity"

  if (method === "manual") {
    assignment_priority = "manual"
  } else if (method === "auto" || method === "smart") {
    if (raw.consider_driver_experience) {
      assignment_priority = "experience"
    } else if (raw.consider_driver_proximity !== false) {
      assignment_priority = "proximity"
    } else {
      assignment_priority = raw.assignment_priority || "availability"
    }
  }

  const loadMax = Number(raw.max_distance_for_auto_assign)
  const dispatchMax = Number(raw.max_assignment_distance)
  let max_distance_for_auto_assign = Number.isFinite(loadMax) && loadMax > 0 ? loadMax : 0
  if (max_distance_for_auto_assign <= 0 && Number.isFinite(dispatchMax) && dispatchMax > 0) {
    max_distance_for_auto_assign = dispatchMax
  }
  if (raw.consider_driver_proximity === false) {
    max_distance_for_auto_assign = 0
  }

  return {
    ...raw,
    assignment_priority,
    max_distance_for_auto_assign,
  }
}
