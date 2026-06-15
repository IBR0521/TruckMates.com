import { parseNotificationChannels, type NotificationChannel } from "@/lib/company-notification-channels"

export type ComplianceNotifyEvent =
  | "document_expiry"
  | "permit_expiry"
  | "roadside_oos"
  | "dot_reportable_incident"
  | "registration_expiry"

export type ComplianceNotificationSettings = {
  notify_on_document_expiry?: boolean | null
  notify_on_permit_expiry?: boolean | null
  notify_on_roadside_oos?: boolean | null
  notify_on_dot_reportable_incident?: boolean | null
  compliance_expiry_lead_days?: number[] | null
  compliance_notification_channels?: unknown
}

export const COMPLIANCE_NOTIFICATION_SETTINGS_SELECT =
  "notify_on_document_expiry, notify_on_permit_expiry, notify_on_roadside_oos, notify_on_dot_reportable_incident, compliance_expiry_lead_days, compliance_notification_channels"

const DEFAULT_LEAD_DAYS = [60, 30, 7]

export function parseComplianceExpiryLeadDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return DEFAULT_LEAD_DAYS
  const parsed = raw
    .map((v) => Math.floor(Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0)
  return parsed.length > 0 ? [...new Set(parsed)].sort((a, b) => b - a) : DEFAULT_LEAD_DAYS
}

export function complianceNotificationChannels(raw: unknown): NotificationChannel[] {
  return parseNotificationChannels(raw)
}

export function isComplianceNotifyEventEnabled(
  settings: ComplianceNotificationSettings | null | undefined,
  event: ComplianceNotifyEvent,
): boolean {
  if (!settings) return true
  switch (event) {
    case "document_expiry":
      return settings.notify_on_document_expiry !== false
    case "permit_expiry":
      return settings.notify_on_permit_expiry !== false
    case "roadside_oos":
      return settings.notify_on_roadside_oos !== false
    case "dot_reportable_incident":
      return settings.notify_on_dot_reportable_incident !== false
    case "registration_expiry":
      return true
    default:
      return true
  }
}
