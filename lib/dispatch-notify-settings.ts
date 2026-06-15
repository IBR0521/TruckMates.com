export type DispatchNotifyEvent =
  | "dispatch"
  | "check_call_missed"
  | "driver_late"
  | "route_deviation"

export type DispatchNotificationSettings = {
  notify_on_dispatch?: boolean | null
  notify_on_check_call_missed?: boolean | null
  notify_on_driver_late?: boolean | null
  notify_on_route_deviation?: boolean | null
  check_call_timeout_minutes?: number | null
  auto_escalate_missed_calls?: boolean | null
  allow_route_deviations?: boolean | null
  max_route_deviation_miles?: number | null
  auto_notify_on_emergency?: boolean | null
  emergency_escalation_minutes?: number | null
}

export const DISPATCH_NOTIFICATION_SETTINGS_SELECT =
  "notify_on_dispatch, notify_on_check_call_missed, notify_on_driver_late, notify_on_route_deviation, check_call_timeout_minutes, auto_escalate_missed_calls, allow_route_deviations, max_route_deviation_miles, auto_notify_on_emergency, emergency_escalation_minutes"

export function isDispatchNotifyEventEnabled(
  settings: DispatchNotificationSettings | null | undefined,
  event: DispatchNotifyEvent,
): boolean {
  if (!settings) return true
  switch (event) {
    case "dispatch":
      return settings.notify_on_dispatch !== false
    case "check_call_missed":
      return settings.notify_on_check_call_missed !== false
    case "driver_late":
      return settings.notify_on_driver_late !== false
    case "route_deviation":
      return settings.notify_on_route_deviation === true
    default:
      return true
  }
}

/** First transition into scheduled or in_transit from a non-dispatched state. */
export function isFirstDispatchTransition(
  previousStatus: unknown,
  nextStatus: unknown,
): boolean {
  const prev = String(previousStatus || "").toLowerCase()
  const next = String(nextStatus || "").toLowerCase()
  const dispatched = new Set(["scheduled", "in_transit"])
  return dispatched.has(next) && !dispatched.has(prev)
}
