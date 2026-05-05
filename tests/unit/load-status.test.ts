import { describe, expect, it } from "vitest"
import {
  ALL_LOAD_STATUSES,
  LOAD_STATUS_TRANSITIONS,
  getAllowedNextLoadStatuses,
  normalizeLoadStatus,
  parseLoadStatus,
} from "../../lib/load-status"

describe("lib/load-status.ts", () => {
  it("parses all valid statuses", () => {
    for (const status of ALL_LOAD_STATUSES) {
      expect(parseLoadStatus(status)).toBe(status)
      expect(parseLoadStatus(status.toUpperCase())).toBe(status)
    }
  })

  it("normalizes invalid statuses to pending", () => {
    expect(parseLoadStatus("not_real")).toBeNull()
    expect(normalizeLoadStatus("not_real")).toBe("pending")
    expect(normalizeLoadStatus(undefined)).toBe("pending")
  })

  it("allows every configured valid transition", () => {
    for (const [from, allowed] of Object.entries(LOAD_STATUS_TRANSITIONS)) {
      expect(getAllowedNextLoadStatuses(from)).toEqual(allowed)
    }
  })

  it("rejects invalid transitions by absence from allowed list", () => {
    for (const from of ALL_LOAD_STATUSES) {
      const allowed = new Set(getAllowedNextLoadStatuses(from))
      for (const to of ALL_LOAD_STATUSES) {
        if (!allowed.has(to) && from !== to) {
          expect(allowed.has(to)).toBe(false)
        }
      }
    }
  })

  it("completed and cancelled are terminal states", () => {
    expect(getAllowedNextLoadStatuses("completed")).toEqual([])
    expect(getAllowedNextLoadStatuses("cancelled")).toEqual([])
  })
})
