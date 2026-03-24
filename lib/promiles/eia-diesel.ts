import { EIA_US_DIESEL_DUOAREA, stateCodeToEiaGndDuoarea } from "./padd-state-map"
import { errorMessage } from "@/lib/error-message"
import type { StateMileRow } from "./state-mileage"

export type DieselPriceByState = Record<string, { pricePerGallon: number; seriesId: string }>

/**
 * EIA Open Data API v2 — petroleum/pri/gnd weekly retail No. 2 diesel by duoarea (PADD).
 * Legacy v1 series IDs (PET.EER_*) return 404 as of 2024+; v2 facets are required.
 * @see https://www.eia.gov/opendata/documentation.php
 */

function parseEiaV2Price(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Latest weekly No. 2 diesel retail ($/gal) for a duoarea (e.g. R1Y = PADD 1B Central Atlantic, NUS = U.S.).
 */
async function fetchLatestGndWeeklyDiesel(
  apiKey: string,
  duoarea: string,
): Promise<{ price: number | null; seriesId: string | null; error: string | null }> {
  try {
    const url = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/")
    url.searchParams.set("api_key", apiKey)
    url.searchParams.set("frequency", "weekly")
    url.searchParams.append("data[0]", "value")
    url.searchParams.append("facets[product][]", "EPD2D")
    url.searchParams.append("facets[duoarea][]", duoarea)
    url.searchParams.append("sort[0][column]", "period")
    url.searchParams.append("sort[0][direction]", "desc")
    url.searchParams.set("length", "1")

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } })
    if (!res.ok) {
      return { price: null, seriesId: null, error: `EIA HTTP ${res.status}` }
    }
    const json = await res.json()
    const row = json?.response?.data?.[0] as
      | { value?: string | number; series?: string }
      | undefined
    const price = parseEiaV2Price(row?.value)
    const seriesId = typeof row?.series === "string" ? row.series : `EPD2D@${duoarea}`
    if (price == null) {
      return { price: null, seriesId: null, error: "EIA: no price in response" }
    }
    return { price, seriesId, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? errorMessage(e) : "EIA request failed"
    return { price: null, seriesId: null, error: msg }
  }
}

/**
 * Fetch latest weekly US average diesel ($/gal) from EIA v2.
 */
export async function fetchLatestUsDieselPrice(apiKey: string): Promise<{ price: number | null; error: string | null }> {
  const { price, error } = await fetchLatestGndWeeklyDiesel(apiKey, EIA_US_DIESEL_DUOAREA)
  return { price, error }
}

/**
 * For each state in the mileage breakdown, assign regional weekly diesel price
 * (EIA `duoarea`: PADD 1 split into R1X/R1Y/R1Z; PADD 2–5 use R20–R50).
 */
export async function buildDieselPricesForStates(
  apiKey: string,
  stateMiles: StateMileRow[],
): Promise<{ byState: DieselPriceByState; error: string | null }> {
  const states = [...new Set(stateMiles.map((r) => r.state_code))]
  const byState: DieselPriceByState = {}
  const duoareaFetched = new Map<string, { price: number; seriesId: string }>()

  for (const st of states) {
    const duoarea = stateCodeToEiaGndDuoarea(st)
    if (!duoareaFetched.has(duoarea)) {
      const { price, seriesId, error } = await fetchLatestGndWeeklyDiesel(apiKey, duoarea)
      if (error || price == null) {
        const fallback = await fetchLatestGndWeeklyDiesel(apiKey, EIA_US_DIESEL_DUOAREA)
        if (fallback.price != null) {
          duoareaFetched.set(duoarea, {
            price: fallback.price,
            seriesId: fallback.seriesId || EIA_US_DIESEL_DUOAREA,
          })
        } else {
          return { byState: {}, error: error || fallback.error || "EIA unavailable" }
        }
      } else {
        duoareaFetched.set(duoarea, { price, seriesId: seriesId || duoarea })
      }
    }
    const row = duoareaFetched.get(duoarea)!
    byState[st] = { pricePerGallon: row.price, seriesId: row.seriesId }
  }

  return { byState, error: null }
}

/**
 * Estimated fuel cost = sum over states ( miles / mpg * price_per_gallon_in_state ).
 */
export function estimateFuelCostUsd(params: {
  stateMiles: StateMileRow[]
  priceByState: DieselPriceByState
  mpg: number
}): number {
  const mpg = params.mpg > 0 ? params.mpg : 6.5
  let total = 0
  for (const row of params.stateMiles) {
    const p = params.priceByState[row.state_code]?.pricePerGallon
    if (p == null || !Number.isFinite(p)) continue
    total += (row.miles / mpg) * p
  }
  return Math.round(total * 100) / 100
}
