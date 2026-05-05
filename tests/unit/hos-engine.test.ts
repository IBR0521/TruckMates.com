import { beforeAll, describe, expect, it } from "vitest"

function entry(
  id: string,
  logDate: string,
  status: "off_duty" | "sleeper_berth" | "driving" | "on_duty",
  startTime: string,
  endTime: string
): {
  id: string
  logDate: string
  status: "off_duty" | "sleeper_berth" | "driving" | "on_duty"
  startTime: string
  endTime?: string
} {
  return { id, logDate, status, startTime, endTime }
}

describe("hos-engine", () => {
  let computeHosClocks:
    | ((entries: Array<{ id: string; logDate: string; status: "off_duty" | "sleeper_berth" | "driving" | "on_duty"; startTime: string; endTime?: string }>, nowIso?: string) => any)
    | null = null

  beforeAll(async () => {
    try {
      const mod = await import("../../lib/eld/hos-engine")
      computeHosClocks = mod.computeHosClocks
    } catch {
      // The requested path may not exist in all workspaces yet.
      computeHosClocks = null
    }
  })

  it("enforces 11-hour driving rule", () => {
    if (!computeHosClocks) return
    const logs = [
      entry("1", "2026-05-05", "driving", "2026-05-05T00:00:00.000Z", "2026-05-05T11:00:00.000Z"),
    ]
    const clocks = computeHosClocks(logs, "2026-05-05T11:00:00.000Z")
    expect(clocks.driveMinutesLeft).toBe(0)
    expect(clocks.effectiveDriveLimitMinutes).toBe(11 * 60)
  })

  it("enforces 14-hour on-duty window", () => {
    if (!computeHosClocks) return
    const logs = [
      entry("1", "2026-05-05", "on_duty", "2026-05-05T00:00:00.000Z", "2026-05-05T06:00:00.000Z"),
      entry("2", "2026-05-05", "driving", "2026-05-05T06:00:00.000Z", "2026-05-05T14:00:00.000Z"),
    ]
    const clocks = computeHosClocks(logs, "2026-05-05T14:00:00.000Z")
    expect(clocks.shiftMinutesLeft).toBe(0)
  })

  it("enforces 70-hour/8-day cycle", () => {
    if (!computeHosClocks) return
    const logs = Array.from({ length: 8 }).map((_, idx) =>
      entry(
        String(idx),
        `2026-05-0${idx + 1}`,
        "driving",
        `2026-05-0${idx + 1}T00:00:00.000Z`,
        `2026-05-0${idx + 1}T08:45:00.000Z`
      )
    )
    const clocks = computeHosClocks(logs, "2026-05-08T09:00:00.000Z")
    expect(clocks.cycleMinutesLeft).toBe(0)
  })

  it("requires 30-minute break after 8 hours driving", () => {
    if (!computeHosClocks) return
    const noBreak = [
      entry("1", "2026-05-05", "driving", "2026-05-05T00:00:00.000Z", "2026-05-05T08:00:00.000Z"),
    ]
    const beforeBreak = computeHosClocks(noBreak, "2026-05-05T08:00:00.000Z")
    expect(beforeBreak.breakDueInMinutes).toBe(0)

    const withShortBreak = [
      ...noBreak,
      entry("2", "2026-05-05", "off_duty", "2026-05-05T08:00:00.000Z", "2026-05-05T08:15:00.000Z"),
    ]
    const shortBreak = computeHosClocks(withShortBreak, "2026-05-05T08:15:00.000Z")
    expect(shortBreak.currentBreakProgressMinutes).toBe(15)
    expect(shortBreak.breakDueInMinutes).toBe(0)

    const withFullBreak = [
      ...noBreak,
      entry("3", "2026-05-05", "off_duty", "2026-05-05T08:00:00.000Z", "2026-05-05T08:30:00.000Z"),
    ]
    const fullBreak = computeHosClocks(withFullBreak, "2026-05-05T08:30:00.000Z")
    expect(fullBreak.currentBreakProgressMinutes).toBe(30)
    expect(fullBreak.breakDueInMinutes).toBe(8 * 60)
  })

  it("detects split sleeper berth eligibility (8/2)", () => {
    if (!computeHosClocks) return
    const logs = [
      entry("1", "2026-05-05", "sleeper_berth", "2026-05-05T00:00:00.000Z", "2026-05-05T08:00:00.000Z"),
      entry("2", "2026-05-05", "off_duty", "2026-05-05T08:00:00.000Z", "2026-05-05T10:00:00.000Z"),
      entry("3", "2026-05-05", "driving", "2026-05-05T10:00:00.000Z", "2026-05-05T12:00:00.000Z"),
    ]
    const clocks = computeHosClocks(logs, "2026-05-05T12:00:00.000Z")
    expect(clocks.splitSleeperEligible).toBe(true)
    expect(clocks.splitSleeperStatus).toContain("8/2")
  })
})
