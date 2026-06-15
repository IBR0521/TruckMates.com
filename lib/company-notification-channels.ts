export type NotificationChannel = "email" | "sms" | "in_app" | "push"

const DEFAULT_CHANNELS: NotificationChannel[] = ["email", "in_app"]

export function parseNotificationChannels(raw: unknown): NotificationChannel[] {
  if (!Array.isArray(raw)) return DEFAULT_CHANNELS
  const allowed = new Set<NotificationChannel>(["email", "sms", "in_app", "push"])
  const parsed = raw
    .map((v) => String(v || "").trim().toLowerCase())
    .filter((v): v is NotificationChannel => allowed.has(v as NotificationChannel))
  return parsed.length > 0 ? parsed : DEFAULT_CHANNELS
}

export function companyAllowsEmail(channels: unknown): boolean {
  return parseNotificationChannels(channels).includes("email")
}

export function companyAllowsSms(channels: unknown): boolean {
  return parseNotificationChannels(channels).includes("sms")
}

export function companyAllowsInApp(channels: unknown): boolean {
  return parseNotificationChannels(channels).includes("in_app")
}

export function companyAllowsPush(channels: unknown): boolean {
  return parseNotificationChannels(channels).includes("push")
}
