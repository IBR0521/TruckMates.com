import { describe, expect, it } from "vitest"
import { calculateFuelSurcharge } from "@/lib/finance-settings"
import { driverHasHazmatEndorsement, getHazmatReadinessError } from "@/lib/compliance-readiness"
import { parseComplianceExpiryLeadDays } from "@/lib/compliance-notify-settings"

describe("finance-settings", () => {
  it("calculates percentage FSC", () => {
    expect(
      calculateFuelSurcharge(
        { fuel_surcharge_method: "percentage", default_fuel_surcharge_percentage: 10 },
        { rate: 1000 },
      ),
    ).toBe(100)
  })

  it("calculates flat-fee FSC", () => {
    expect(
      calculateFuelSurcharge(
        { fuel_surcharge_method: "flat-fee", fuel_surcharge_flat_amount: 50 },
        { rate: 1000 },
      ),
    ).toBe(50)
  })

  it("returns zero for none", () => {
    expect(calculateFuelSurcharge({ fuel_surcharge_method: "none" }, { rate: 1000 })).toBe(0)
  })
})

describe("compliance-readiness", () => {
  it("detects H endorsement", () => {
    expect(driverHasHazmatEndorsement(["H", "N"])).toBe(true)
    expect(driverHasHazmatEndorsement("CDL")).toBe(false)
  })

  it("blocks hazmat without shipping fields", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { license_endorsements: ["H"] } }),
            }),
          }),
        }),
      }),
    } as never
    const err = await getHazmatReadinessError(
      supabase,
      "c1",
      { is_hazardous: true, un_number: null, hazard_class: "3", proper_shipping_name: null },
      "d1",
    )
    expect(err).toContain("UN number")
  })
})

describe("compliance-notify-settings", () => {
  it("parses lead days", () => {
    expect(parseComplianceExpiryLeadDays([30, 7, 60])).toEqual([60, 30, 7])
    expect(parseComplianceExpiryLeadDays(null)).toEqual([60, 30, 7])
  })
})
