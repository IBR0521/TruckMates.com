import { describe, expect, it } from "vitest"
import { scoreFuelStops, type FuelStopCandidate } from "../../lib/promiles/fuel-optimizer"

describe("lib/promiles/fuel-optimizer.ts", () => {
  it("factors detour cost against fuel savings in score", () => {
    const path = [
      { lat: 32.7767, lng: -96.797 },
      { lat: 32.9, lng: -96.5 },
      { lat: 33.2, lng: -96.2 },
    ]

    const candidates: FuelStopCandidate[] = [
      {
        id: "near-expensive",
        name: "Near Expensive",
        address: "A",
        stateCode: "TX",
        lat: 32.901,
        lng: -96.499,
      },
      {
        id: "far-cheap",
        name: "Far Cheap",
        address: "B",
        stateCode: "OK",
        lat: 34.2,
        lng: -97.6,
      },
    ]

    const scored = scoreFuelStops({
      path,
      candidates,
      gallonsNeeded: 100,
      fuelCostPerMile: 2.5,
      priceByState: {
        TX: { pricePerGallon: 4.2 },
        OK: { pricePerGallon: 3.5 },
        US: { pricePerGallon: 4.0 },
      },
      maxOutOfRouteMiles: 500,
      topN: 2,
    })

    expect(scored).toHaveLength(2)
    const near = scored.find((s) => s.id === "near-expensive")
    const far = scored.find((s) => s.id === "far-cheap")
    expect(near).toBeTruthy()
    expect(far).toBeTruthy()
    expect(far!.fuelSpendUsd).toBeLessThan(near!.fuelSpendUsd)
    expect(far!.detourCostUsd).toBeGreaterThan(near!.detourCostUsd)
    expect(near!.scoreUsd).toBeLessThan(far!.scoreUsd)
  })
})
