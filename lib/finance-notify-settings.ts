import { parseNotificationChannels, type NotificationChannel } from "@/lib/company-notification-channels"

export type FinanceNotifyEvent = "invoice_overdue" | "factoring_status" | "auto_invoice_drafted"

export type FinanceNotificationSettings = {
  notify_on_invoice_overdue?: boolean | null
  notify_on_factoring_status?: boolean | null
  finance_notification_channels?: unknown
}

export const FINANCE_NOTIFICATION_SETTINGS_SELECT =
  "notify_on_invoice_overdue, notify_on_factoring_status, finance_notification_channels"

export function financeNotificationChannels(raw: unknown): NotificationChannel[] {
  return parseNotificationChannels(raw)
}

export function isFinanceNotifyEventEnabled(
  settings: FinanceNotificationSettings | null | undefined,
  event: FinanceNotifyEvent,
): boolean {
  if (!settings) return true
  switch (event) {
    case "invoice_overdue":
      return settings.notify_on_invoice_overdue !== false
    case "factoring_status":
      return settings.notify_on_factoring_status !== false
    case "auto_invoice_drafted":
      return true
    default:
      return true
  }
}
