/** Columns fetched for Operations dispatch / workflow enforcement. */
export const OPERATIONS_WORKFLOW_SETTINGS_SELECT =
  "require_bol_before_dispatch, require_documents_before_dispatch, required_documents, dispatch_approval_required, auto_dispatch_on_ready, allow_status_skip, require_confirmation_before_dispatch, notify_on_load_created, notify_on_status_change, notify_on_delivery, notify_driver_on_assignment, notify_on_delivery_delay, notify_on_dispatch, assignment_priority, consider_driver_hours, consider_truck_maintenance, max_distance_for_auto_assign, required_statuses"

export type OperationsWorkflowSettings = {
  require_bol_before_dispatch?: boolean | null
  require_documents_before_dispatch?: boolean | null
  required_documents?: unknown
  auto_assign_driver?: boolean | null
  auto_assign_truck?: boolean | null
  dispatch_approval_required?: boolean | null
  auto_dispatch_on_ready?: boolean | null
  allow_status_skip?: boolean | null
  require_confirmation_before_dispatch?: boolean | null
  notify_on_load_created?: boolean | null
  notify_on_status_change?: boolean | null
  notify_on_delivery?: boolean | null
  notify_driver_on_assignment?: boolean | null
  notify_on_delivery_delay?: boolean | null
  notify_on_dispatch?: boolean | null
  assignment_priority?: string | null
  consider_driver_hours?: boolean | null
  consider_truck_maintenance?: boolean | null
  max_distance_for_auto_assign?: number | null
  required_statuses?: unknown
}

export function parseRequiredStatuses(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return ["pending", "scheduled", "in_transit", "delivered"]
  }
  return raw.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean)
}
