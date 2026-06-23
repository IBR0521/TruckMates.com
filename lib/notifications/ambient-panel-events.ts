/** metadata.event values from standalone cron notify systems eligible for the ambient panel. */
export const AMBIENT_PANEL_NOTIFY_EVENTS = [
  "invoice_overdue",
  "permit_expiry",
  "delivery_delay",
  "document_expiry",
  "emergency_check_call",
  "check_call_missed",
  "driver_late",
  "emergency_escalation",
  "route_deviation",
] as const

export type AmbientPanelNotifyEvent = (typeof AMBIENT_PANEL_NOTIFY_EVENTS)[number]

export function isAmbientPanelNotifyEvent(value: unknown): value is AmbientPanelNotifyEvent {
  return (
    typeof value === "string" &&
    (AMBIENT_PANEL_NOTIFY_EVENTS as readonly string[]).includes(value)
  )
}

export function isUrgentPriority(value: string | null | undefined): boolean {
  const p = String(value || "").toLowerCase()
  return p === "critical" || p === "high"
}
