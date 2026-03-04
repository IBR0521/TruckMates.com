/**
 * US State Fuel Tax Rates (per gallon)
 * 
 * EXT-009 FIX: Consolidated fuel tax rates to prevent inconsistencies between modules
 * Last updated: 2024 (rates should be updated quarterly from IFTA Clearinghouse)
 * Source: IFTA Clearinghouse (https://www.iftach.org/)
 * 
 * These rates are used by both IFTA reporting and fuel tax reconciliation modules.
 * Always import from this file instead of hardcoding rates in individual modules.
 */

export const STATE_FUEL_TAX_RATES: Record<string, number> = {
  // Using the more recent/accurate rates from tax-fuel-reconciliation.ts as base
  // These should be updated quarterly from IFTA Clearinghouse
  AL: 0.24, AK: 0.0895, AZ: 0.19, AR: 0.2475, CA: 0.51,
  CO: 0.22, CT: 0.35, DE: 0.23, FL: 0.33, GA: 0.2875,
  HI: 0.16, ID: 0.33, IL: 0.39, IN: 0.33, IA: 0.305,
  KS: 0.24, KY: 0.26, LA: 0.20, ME: 0.30, MD: 0.33,
  MA: 0.24, MI: 0.27, MN: 0.285, MS: 0.18, MO: 0.17,
  MT: 0.32, NE: 0.29, NV: 0.23, NH: 0.23, NJ: 0.105,
  NM: 0.17, NY: 0.33, NC: 0.36, ND: 0.23, OH: 0.385,
  OK: 0.20, OR: 0.38, PA: 0.58, RI: 0.34, SC: 0.24,
  SD: 0.28, TN: 0.26, TX: 0.20, UT: 0.305, VT: 0.31,
  VA: 0.26, WA: 0.494, WV: 0.35, WI: 0.309, WY: 0.24,
  DC: 0.235
}

/**
 * Get fuel tax rate for a state
 * @param stateCode - Two-letter state code (e.g., "CA", "TX")
 * @param defaultRate - Default rate if state not found (default: 0.25)
 * @returns Fuel tax rate per gallon
 */
export function getFuelTaxRate(stateCode: string, defaultRate: number = 0.25): number {
  return STATE_FUEL_TAX_RATES[stateCode.toUpperCase()] || defaultRate
}

