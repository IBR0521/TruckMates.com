import type { ExtractedRateConOrBol } from "@/lib/ai/documents/structured-extraction"

export type DiscrepancySeverity = "high" | "medium" | "low"

export type DocumentDiscrepancy = {
  key: string
  severity: DiscrepancySeverity
  message: string
  extracted_value: unknown
  record_value: unknown
}

type LoadLike = {
  id: string
  origin?: string | null
  destination?: string | null
  load_date?: string | null
  estimated_delivery?: string | null
  rate?: number | null
  total_rate?: number | null
  fuel_surcharge?: number | null
  accessorial_charges?: number | null
  bol_number?: string | null
}

type InvoiceLike = {
  id: string
  amount?: number | null
  customer_name?: string | null
  status?: string | null
}

function normText(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function normDate(v: unknown): string {
  return String(v ?? "").trim().slice(0, 10)
}

function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) ? n : null
}

function near(a: number, b: number, tolUsd: number): boolean {
  return Math.abs(a - b) <= tolUsd
}

export const DEFAULT_RATE_TOLERANCE_USD = 25

export function compareExtractedToRecords(params: {
  extracted: ExtractedRateConOrBol
  load: LoadLike | null
  invoice: InvoiceLike | null
  rateToleranceUsd?: number
}): DocumentDiscrepancy[] {
  const d: DocumentDiscrepancy[] = []
  const tol = typeof params.rateToleranceUsd === "number" ? params.rateToleranceUsd : DEFAULT_RATE_TOLERANCE_USD

  const load = params.load
  const inv = params.invoice
  const ex = params.extracted

  if (load) {
    if (ex.lane.origin && load.origin && normText(ex.lane.origin) !== normText(load.origin)) {
      d.push({
        key: "lane_origin_mismatch",
        severity: "low",
        message: "Origin differs from the linked load record.",
        extracted_value: ex.lane.origin,
        record_value: load.origin,
      })
    }
    if (ex.lane.destination && load.destination && normText(ex.lane.destination) !== normText(load.destination)) {
      d.push({
        key: "lane_destination_mismatch",
        severity: "low",
        message: "Destination differs from the linked load record.",
        extracted_value: ex.lane.destination,
        record_value: load.destination,
      })
    }
    if (ex.pickup_date && load.load_date && normDate(ex.pickup_date) !== normDate(load.load_date)) {
      d.push({
        key: "pickup_date_mismatch",
        severity: "low",
        message: "Pickup date differs from the linked load record.",
        extracted_value: ex.pickup_date,
        record_value: load.load_date,
      })
    }
    if (ex.delivery_date && load.estimated_delivery && normDate(ex.delivery_date) !== normDate(load.estimated_delivery)) {
      d.push({
        key: "delivery_date_mismatch",
        severity: "low",
        message: "Delivery date differs from the linked load record.",
        extracted_value: ex.delivery_date,
        record_value: load.estimated_delivery,
      })
    }
  }

  // Rate comparisons
  const extractedRate = money(ex.rate_total_usd)
  const loadRate = load ? money(load.total_rate ?? load.rate ?? null) : null
  const invoiceAmount = inv ? money(inv.amount ?? null) : null

  if (extractedRate !== null && loadRate !== null && !near(extractedRate, loadRate, tol)) {
    const key = extractedRate > loadRate ? "rate_above_load" : "rate_below_load"
    d.push({
      key,
      severity: extractedRate < loadRate ? "high" : "medium",
      message:
        extractedRate < loadRate
          ? "Rate confirmation indicates a lower total than the linked load record."
          : "Rate confirmation indicates a higher total than the linked load record.",
      extracted_value: extractedRate,
      record_value: loadRate,
    })
  }

  if (extractedRate !== null && invoiceAmount !== null && !near(extractedRate, invoiceAmount, tol)) {
    d.push({
      key: extractedRate > invoiceAmount ? "shorted_rate_vs_confirmed" : "invoice_above_confirmed",
      severity: extractedRate > invoiceAmount ? "high" : "medium",
      message:
        extractedRate > invoiceAmount
          ? "Invoice total is lower than the confirmed rate."
          : "Invoice total is higher than the confirmed rate.",
      extracted_value: extractedRate,
      record_value: invoiceAmount,
    })
  }

  // Accessorials (only a basic sanity check for v1, since the DB does not store structured accessorial line items)
  const extractedAccessorialTotal = ex.accessorials.reduce((sum, a) => sum + (money(a.amount_usd) || 0), 0)
  const loadAccessorialTotal = load ? money(load.accessorial_charges ?? 0) : null
  if (loadAccessorialTotal !== null && extractedAccessorialTotal > 0 && loadAccessorialTotal === 0) {
    d.push({
      key: "accessorials_missing_on_load",
      severity: "medium",
      message: "Document lists accessorials but the linked load has no accessorial charges recorded.",
      extracted_value: ex.accessorials,
      record_value: load?.accessorial_charges ?? 0,
    })
  }

  return d
}

