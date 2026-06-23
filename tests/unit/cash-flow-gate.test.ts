import { describe, expect, it } from "vitest"
import {
  CASH_FLOW_TIER0,
  cashFlowSnapshotFingerprint,
  evaluateCashFlowTier0,
  resolveCashFlowProjectionThreshold,
} from "@/lib/ai/agent/cash-flow-gate"

describe("evaluateCashFlowTier0", () => {
  it("skips inactive companies (zero AR and settlements)", () => {
    const result = evaluateCashFlowTier0({
      projectedCashPosition14Days: 0,
      totalArOutstanding: 0,
      upcomingSettlementsTotal: 0,
    })
    expect(result.shouldAct).toBe(false)
  })

  it("fires when projection is below default threshold", () => {
    const result = evaluateCashFlowTier0({
      projectedCashPosition14Days: 3810,
      totalArOutstanding: 22500,
      upcomingSettlementsTotal: 18690,
    })
    expect(result.shouldAct).toBe(true)
    expect(result.triggers.some((t) => t.startsWith("projection_below_threshold"))).toBe(true)
  })

  it("skips healthy projection above threshold with no prior snapshot", () => {
    const result = evaluateCashFlowTier0({
      projectedCashPosition14Days: 62110,
      totalArOutstanding: 107500,
      upcomingSettlementsTotal: 45390,
    })
    expect(result.shouldAct).toBe(false)
  })

  it("fires on material change even when above threshold", () => {
    const result = evaluateCashFlowTier0(
      {
        projectedCashPosition14Days: 12000,
        totalArOutstanding: 20000,
        upcomingSettlementsTotal: 8000,
      },
      { previousProjection: 20000, projectionThresholdUsd: 10000 },
    )
    expect(result.shouldAct).toBe(true)
    expect(result.triggers.some((t) => t.startsWith("material_change"))).toBe(true)
  })

  it("fires when projection crosses zero", () => {
    const result = evaluateCashFlowTier0(
      {
        projectedCashPosition14Days: -100,
        totalArOutstanding: 1000,
        upcomingSettlementsTotal: 1100,
      },
      { previousProjection: 500, projectionThresholdUsd: 10000 },
    )
    expect(result.shouldAct).toBe(true)
    expect(result.triggers.some((t) => t.startsWith("crossed_zero"))).toBe(true)
  })
})

describe("resolveCashFlowProjectionThreshold", () => {
  it("uses company config override when set", () => {
    expect(resolveCashFlowProjectionThreshold({ projectionThresholdUsd: 25000 })).toBe(25000)
  })

  it("falls back to platform default", () => {
    expect(resolveCashFlowProjectionThreshold({})).toBe(CASH_FLOW_TIER0.defaultProjectionThresholdUsd)
  })
})

describe("cashFlowSnapshotFingerprint", () => {
  it("buckets projection and AR to stable keys", () => {
    expect(
      cashFlowSnapshotFingerprint({
        projectedCashPosition14Days: 3810,
        totalArOutstanding: 22500,
        upcomingSettlementsTotal: 18690,
      }),
    ).toEqual({ cash_flow: "4:23" })
  })
})
