import type { OperationsWorkflowSettings } from "./load-workflow-settings"
import { isDispatchNotifyEventEnabled } from "./dispatch-notify-settings"

export type LoadNotifyEvent =
  | "load_created"
  | "status_change"
  | "delivered"
  | "driver_assigned"
  | "dispatched"

export function isLoadNotifyEventEnabled(
  settings: OperationsWorkflowSettings | null | undefined,
  event: LoadNotifyEvent,
): boolean {
  if (!settings) return true
  switch (event) {
    case "load_created":
      return settings.notify_on_load_created !== false
    case "status_change":
      return settings.notify_on_status_change !== false
    case "delivered":
      return settings.notify_on_delivery !== false
    case "driver_assigned":
      return settings.notify_driver_on_assignment !== false
    case "dispatched":
      return isDispatchNotifyEventEnabled(settings, "dispatch")
    default:
      return true
  }
}
