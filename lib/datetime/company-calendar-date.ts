/**
 * Calendar date (YYYY-MM-DD) for `instant` interpreted in IANA `timeZone`.
 */
export function calendarDateInTimeZone(instant: Date, timeZone: string | null | undefined): string {
  const tz = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "UTC"
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant)
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant)
  }
}
