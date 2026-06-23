import { describe, expect, it } from "vitest"
import {
  csaScoreBucketFingerprint,
  extractDedupFingerprint,
  extractEntityIds,
  fingerprintsOverlap,
} from "@/lib/ai/agent/dedup-fingerprints"

const AGENT_DEDUP_COOLDOWN_MINUTES = 60

/** Mirrors loop.ts: would a prior triggered log block this evaluation? */
function wouldApplyCooldown(params: {
  trigger: string
  priorTriggerData: Record<string, unknown>
  currentTriggerData: Record<string, unknown>
}): boolean {
  const prior = extractDedupFingerprint(params.trigger, params.priorTriggerData)
  const current = extractDedupFingerprint(params.trigger, params.currentTriggerData)
  if (Object.keys(current).length === 0) return false
  return fingerprintsOverlap(prior, current)
}

describe("extractEntityIds", () => {
  it("detects load, driver, truck, customer, and invoice ids", () => {
    expect(
      extractEntityIds({
        loadId: "load-1",
        driver_id: "drv-1",
        truckId: "trk-1",
        customerId: "cust-1",
        invoiceId: "inv-1",
      }),
    ).toEqual({
      load: "load-1",
      driver: "drv-1",
      truck: "trk-1",
      customer: "cust-1",
      invoice: "inv-1",
    })
  })
})

describe("csaScoreBucketFingerprint", () => {
  it("groups scores into 5-point buckets", () => {
    expect(csaScoreBucketFingerprint("hours_of_service", 57)).toEqual({ csa: "hours_of_service:55" })
    expect(csaScoreBucketFingerprint("hours_of_service", 58)).toEqual({ csa: "hours_of_service:55" })
    expect(csaScoreBucketFingerprint("hours_of_service", 62)).toEqual({ csa: "hours_of_service:60" })
  })
})

describe("extractDedupFingerprint", () => {
  it("uses invoice id only for payment_followup (not shared customer)", () => {
    expect(
      extractDedupFingerprint("payment_followup", {
        invoiceId: "inv-99",
        customerId: "cust-1",
      }),
    ).toEqual({ invoice: "inv-99" })
  })

  it("uses customer id for credit_hold", () => {
    expect(extractDedupFingerprint("credit_hold", { customerId: "cust-42" })).toEqual({
      customer: "cust-42",
    })
  })

  it("fingerprints csa_threshold_alert by category and score bucket", () => {
    expect(
      extractDedupFingerprint("csa_threshold_alert", {
        basicCategory: "hours_of_service",
        score: 57,
        threshold: 55,
      }),
    ).toEqual({ csa: "hours_of_service:55" })
  })

  it("fingerprints cash_flow_alert by projection and AR buckets", () => {
    expect(
      extractDedupFingerprint("cash_flow_alert", {
        projectedCashPosition14Days: 3810,
        totalArOutstanding: 22500,
        upcomingSettlementsTotal: 18690,
      }),
    ).toEqual({ cash_flow: "4:23" })
  })

  it("uses transaction id for fuel_anomaly when no entity ids", () => {
    expect(extractDedupFingerprint("fuel_anomaly", { transactionId: "tx-1" })).toEqual({
      transaction: "tx-1",
    })
  })

  it("prefers entity ids over trigger fingerprint for fuel_anomaly", () => {
    expect(
      extractDedupFingerprint("fuel_anomaly", {
        transactionId: "tx-1",
        driverId: "drv-1",
      }),
    ).toEqual({ driver: "drv-1" })

    expect(
      extractDedupFingerprint("fuel_anomaly", {
        transactionId: "WEX-ext-123",
        truckId: "trk-9",
        driverId: null,
      }),
    ).toEqual({ truck: "trk-9" })
  })
})

describe("AGENT_DEDUP_COOLDOWN_MINUTES trace (fingerprint → overlap → skip)", () => {
  it("payment_followup: same invoice blocked, different invoice on same customer allowed", () => {
    const prior = { invoiceId: "inv-1", customerId: "cust-A", daysOutstanding: 31 }
    const sameInvoice = { invoiceId: "inv-1", customerId: "cust-A", daysOutstanding: 31 }
    const otherInvoice = { invoiceId: "inv-2", customerId: "cust-A", daysOutstanding: 61 }

    expect(wouldApplyCooldown({ trigger: "payment_followup", priorTriggerData: prior, currentTriggerData: sameInvoice })).toBe(true)
    expect(wouldApplyCooldown({ trigger: "payment_followup", priorTriggerData: prior, currentTriggerData: otherInvoice })).toBe(false)
    expect(AGENT_DEDUP_COOLDOWN_MINUTES).toBe(60)
  })

  it("credit_hold: same customer blocked within cooldown window", () => {
    const prior = { customerId: "cust-42", currentAR: 50000, creditLimit: 40000 }
    const repeat = { customerId: "cust-42", currentAR: 52000, creditLimit: 40000 }
    const otherCustomer = { customerId: "cust-99", currentAR: 50000, creditLimit: 40000 }

    expect(wouldApplyCooldown({ trigger: "credit_hold", priorTriggerData: prior, currentTriggerData: repeat })).toBe(true)
    expect(wouldApplyCooldown({ trigger: "credit_hold", priorTriggerData: prior, currentTriggerData: otherCustomer })).toBe(false)
  })

  it("csa_threshold_alert: same category+bucket blocked, new bucket allowed", () => {
    const prior = { basicCategory: "hours_of_service", score: 57, threshold: 55, severity: "warning" }
    const sameBucket = { basicCategory: "hours_of_service", score: 58, threshold: 55, severity: "warning" }
    const newBucket = { basicCategory: "hours_of_service", score: 62, threshold: 55, severity: "warning" }

    expect(wouldApplyCooldown({ trigger: "csa_threshold_alert", priorTriggerData: prior, currentTriggerData: sameBucket })).toBe(true)
    expect(wouldApplyCooldown({ trigger: "csa_threshold_alert", priorTriggerData: prior, currentTriggerData: newBucket })).toBe(false)
  })

  it("fuel_anomaly CSV import path: truckId optional, transactionId always dedups", () => {
    const csvWithTruck = {
      transactionId: "COMDATA-42",
      driverId: "drv-1",
      truckId: "trk-1",
      amount: 500,
    }
    const csvWithoutTruck = {
      transactionId: "COMDATA-43",
      driverId: null,
      truckId: null,
      amount: 500,
    }

    expect(extractDedupFingerprint("fuel_anomaly", csvWithTruck)).toEqual({
      driver: "drv-1",
      truck: "trk-1",
    })
    expect(extractDedupFingerprint("fuel_anomaly", csvWithoutTruck)).toEqual({ transaction: "COMDATA-43" })

    expect(
      wouldApplyCooldown({
        trigger: "fuel_anomaly",
        priorTriggerData: csvWithoutTruck,
        currentTriggerData: { transactionId: "COMDATA-43", truckId: null },
      }),
    ).toBe(true)
  })

  it("fuel_anomaly live sync path: truckId optional, receipt_number always dedups", () => {
    const syncWithTruck = {
      transactionId: "WEX-ext-999",
      driverId: "drv-2",
      truckId: "trk-5",
      amount: 800,
    }
    const syncWithoutTruck = {
      transactionId: "WEX-ext-1000",
      driverId: null,
      truckId: null,
      amount: 800,
    }

    expect(extractDedupFingerprint("fuel_anomaly", syncWithTruck)).toEqual({
      driver: "drv-2",
      truck: "trk-5",
    })
    expect(extractDedupFingerprint("fuel_anomaly", syncWithoutTruck)).toEqual({ transaction: "WEX-ext-1000" })
  })
})
