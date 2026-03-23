/**
 * Map US state abbreviations → EIA PADD region (1–5) for weekly diesel series.
 * @see https://www.eia.gov/todayinenergy/detail.php?id=3390
 *
 * For **diesel retail pricing**, use {@link stateCodeToEiaGndDuoarea} instead — PADD 1 must be
 * split into 1A / 1B / 1C (`R1X` / `R1Y` / `R1Z`). Using aggregate `R10` blends the entire East Coast
 * and overstates prices for NJ/NY/PA (Central Atlantic).
 */
export function stateCodeToPadd(stateCode: string): 1 | 2 | 3 | 4 | 5 {
  const s = stateCode.toUpperCase()

  // PADD 1 — East Coast
  const p1 = new Set([
    "CT",
    "ME",
    "MA",
    "NH",
    "RI",
    "VT",
    "NJ",
    "NY",
    "PA",
    "DE",
    "MD",
    "DC",
  ])
  // PADD 2 — Midwest
  const p2 = new Set([
    "OH",
    "IN",
    "IL",
    "MI",
    "WI",
    "MN",
    "IA",
    "MO",
    "ND",
    "SD",
    "NE",
    "KS",
    "KY",
    "TN",
  ])
  // PADD 3 — Gulf Coast
  const p3 = new Set(["OK", "AR", "LA", "TX", "NM", "MS", "AL"])
  // PADD 4 — Rocky Mountain
  const p4 = new Set(["MT", "ID", "WY", "UT", "CO"])
  // PADD 5 — West Coast (+ AZ, NV often grouped with PADD 5 in retail series)
  const p5 = new Set(["WA", "OR", "CA", "AZ", "NV", "AK", "HI"])

  if (p1.has(s)) return 1
  if (p2.has(s)) return 2
  if (p3.has(s)) return 3
  if (p4.has(s)) return 4
  if (p5.has(s)) return 5

  // Default: US average / unknown → PADD 3 (central US trucking corridor)
  return 3
}

/**
 * EIA API v2 `petroleum/pri/gnd` facet `duoarea` for weekly retail No. 2 diesel ($/gal).
 *
 * PADD 1 is split per EIA (same as PADD 1A / 1B / 1C in supply statistics):
 * - **R1X** — PADD 1A New England (CT, ME, MA, NH, RI, VT)
 * - **R1Y** — PADD 1B Central Atlantic (DE, DC, MD, **NJ**, NY, PA)
 * - **R1Z** — PADD 1C Lower Atlantic (FL, GA, NC, SC, VA, WV)
 *
 * PADD 2–5 use aggregate facets **R20–R50** (no sub-split in EIA GND for these).
 *
 * @see https://www.eia.gov/totalenergy/data/monthly/pdf/sec1_17.pdf (PADD boundaries)
 */
export function stateCodeToEiaGndDuoarea(stateCode: string): string {
  const s = stateCode.toUpperCase()

  // PADD 1A — New England
  if (new Set(["CT", "ME", "MA", "NH", "RI", "VT"]).has(s)) return "R1X"
  // PADD 1B — Central Atlantic (NJ, NY, PA, DE, MD, DC)
  if (new Set(["DE", "DC", "MD", "NJ", "NY", "PA"]).has(s)) return "R1Y"
  // PADD 1C — Lower Atlantic
  if (new Set(["FL", "GA", "NC", "SC", "VA", "WV"]).has(s)) return "R1Z"

  // PADD 2 — Midwest
  if (
    new Set([
      "OH",
      "IN",
      "IL",
      "MI",
      "WI",
      "MN",
      "IA",
      "MO",
      "ND",
      "SD",
      "NE",
      "KS",
      "KY",
      "TN",
    ]).has(s)
  ) {
    return "R20"
  }
  // PADD 3 — Gulf Coast
  if (new Set(["OK", "AR", "LA", "TX", "NM", "MS", "AL"]).has(s)) return "R30"
  // PADD 4 — Rocky Mountain
  if (new Set(["MT", "ID", "WY", "UT", "CO"]).has(s)) return "R40"
  // PADD 5 — West Coast (+ AZ, NV, AK, HI)
  if (new Set(["WA", "OR", "CA", "AZ", "NV", "AK", "HI"]).has(s)) return "R50"

  // Unknown → Gulf Coast aggregate (matches previous default PADD 3)
  return "R30"
}

/**
 * EIA API v2 `petroleum/pri/gnd` duoarea facet IDs (weekly No. 2 diesel retail).
 * **Note:** PADD 1 should use {@link stateCodeToEiaGndDuoarea} — do not use `1 → R10` for pricing.
 */
export const EIA_DIESEL_DUOAREA_BY_PADD: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "R10",
  2: "R20",
  3: "R30",
  4: "R40",
  5: "R50",
}

/** U.S. aggregate (national) */
export const EIA_US_DIESEL_DUOAREA = "NUS"

/** @deprecated Use EIA_DIESEL_DUOAREA_BY_PADD + EIA v2 — kept for old docs */
export const EIA_DIESEL_SERIES_BY_PADD: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "PET.EER_EPM0D_PTE_R10_D.W",
  2: "PET.EER_EPM0D_PTE_R20_D.W",
  3: "PET.EER_EPM0D_PTE_R30_D.W",
  4: "PET.EER_EPM0D_PTE_R40_D.W",
  5: "PET.EER_EPM0D_PTE_R50_D.W",
}

/** @deprecated Use EIA_US_DIESEL_DUOAREA */
export const EIA_US_DIESEL_SERIES = "PET.EER_EPM0D_PTE_NUS_D.W"
