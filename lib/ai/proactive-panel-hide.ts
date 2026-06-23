import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export const COLLAPSE_UNTIL_KEY = "aiProactivePanelCollapsedUntil"
export const DEFAULT_COLLAPSE_MS = 15 * 60 * 1000

export function isPanelHidden(hiddenUntil: number, now = Date.now()): boolean {
  return hiddenUntil > now
}

export function isCriticalNotificationPayload(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): boolean {
  if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return false
  const row = payload.new
  if (!row || typeof row !== "object") return false
  return (
    String(row.ai_priority || "").toLowerCase() === "critical" ||
    String(row.priority || "").toLowerCase() === "critical"
  )
}

/** True when a critical notification arrives while the temporary hide window is active. */
export function shouldClearHideForCriticalNotification(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  hiddenUntil: number,
  now = Date.now(),
): boolean {
  return isPanelHidden(hiddenUntil, now) && isCriticalNotificationPayload(payload)
}

export function clearPanelHideInStorage(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(COLLAPSE_UNTIL_KEY)
  }
}
