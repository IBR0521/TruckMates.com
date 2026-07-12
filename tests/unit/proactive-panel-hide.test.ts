import { describe, expect, it } from "vitest"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import {
  COLLAPSE_UNTIL_KEY,
  DEFAULT_COLLAPSE_MS,
  isCriticalNotificationPayload,
  isPanelHidden,
  shouldClearHideForCriticalNotification,
} from "../../lib/ai/proactive-panel-hide"

function insertPayload(aiPriority: string): RealtimePostgresChangesPayload<Record<string, unknown>> {
  return {
    schema: "public",
    table: "notifications",
    commit_timestamp: "2026-06-20T12:00:00.000Z",
    eventType: "INSERT",
    new: {
      id: "notif-1",
      ai_priority: aiPriority,
      source: "ai_proactive",
    },
    old: {},
    errors: [],
  }
}

describe("lib/ai/proactive-panel-hide.ts", () => {
  const now = 1_700_000_000_000
  const hiddenUntil = now + DEFAULT_COLLAPSE_MS

  it("treats panel as hidden only while hiddenUntil is in the future", () => {
    expect(isPanelHidden(hiddenUntil, now)).toBe(true)
    expect(isPanelHidden(hiddenUntil, hiddenUntil)).toBe(false)
    expect(isPanelHidden(0, now)).toBe(false)
  })

  it("detects critical INSERT/UPDATE payloads only", () => {
    expect(isCriticalNotificationPayload(insertPayload("critical"))).toBe(true)
    expect(isCriticalNotificationPayload(insertPayload("Critical"))).toBe(true)
    expect(isCriticalNotificationPayload({ ...insertPayload("high"), new: { priority: "critical" } })).toBe(true)
    expect(isCriticalNotificationPayload(insertPayload("high"))).toBe(false)
    expect(isCriticalNotificationPayload({ ...insertPayload("critical"), eventType: "DELETE" })).toBe(false)
  })

  it("clears hide when a critical notification arrives mid-hide-window", () => {
    expect(shouldClearHideForCriticalNotification(insertPayload("critical"), hiddenUntil, now)).toBe(true)
  })

  it("keeps hide when high or medium notifications arrive mid-hide-window", () => {
    expect(shouldClearHideForCriticalNotification(insertPayload("high"), hiddenUntil, now)).toBe(false)
    expect(shouldClearHideForCriticalNotification(insertPayload("medium"), hiddenUntil, now)).toBe(false)
  })

  it("simulates mid-hide-window arrival clearing localStorage for critical only", () => {
    const storage = new Map<string, string>()
    storage.set(COLLAPSE_UNTIL_KEY, String(hiddenUntil))

    const applyRealtimeDuringHide = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (shouldClearHideForCriticalNotification(payload, hiddenUntil, now)) {
        storage.delete(COLLAPSE_UNTIL_KEY)
      }
    }

    applyRealtimeDuringHide(insertPayload("high"))
    expect(storage.has(COLLAPSE_UNTIL_KEY)).toBe(true)

    applyRealtimeDuringHide(insertPayload("critical"))
    expect(storage.has(COLLAPSE_UNTIL_KEY)).toBe(false)
  })
})
