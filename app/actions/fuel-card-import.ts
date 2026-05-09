"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { runAgentEvaluation } from "@/lib/ai/agent/loop"

/**
 * Fuel Card Import
 * Handles importing fuel purchases from Comdata, Wex, P-Fleet, and other fuel card providers
 */

export interface FuelCardImportResult {
  success: number
  failed: number
  errors: Array<{ row: number; error: string }>
  imported: Array<{
    purchase_date: string
    state: string
    gallons: number
    total_cost: number
    truck_number?: string
  }>
}

/**
 * Parse CSV file content
 */
function parseCSV(content: string): string[][] {
  const lines = content.split("\n").filter((line) => line.trim())
  return lines.map((line) => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  })
}

/**
 * Parse Excel file (CSV format) - simplified parser
 */
function parseExcelCSV(content: string): string[][] {
  return parseCSV(content)
}

function normalizeProductType(productType: string | null | undefined): string {
  return String(productType || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function isUnexpectedProductType(productType: string | null | undefined): boolean {
  const normalized = normalizeProductType(productType)
  if (!normalized) return false
  return !normalized.includes("diesel") && normalized !== "def"
}

/**
 * Import Comdata fuel card data
 * Expected format: Date, Truck Number, Location, State, Gallons, Price/Gallon, Total
 */
export async function importComdataFuelData(
  fileContent: string,
  fileName: string
): Promise<{
  data: FuelCardImportResult | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // BUG-071 FIX: Add size and row count limits to prevent DoS attacks
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
    const MAX_ROWS = 10000 // Maximum 10,000 rows
    
    if (fileContent.length > MAX_FILE_SIZE) {
      return { 
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB. Please split your file into smaller chunks.`, 
        data: null 
      }
    }
    
    const rows = parseCSV(fileContent)
    if (rows.length < 2) {
      return { error: "CSV file must have at least a header row and one data row", data: null }
    }
    
    if (rows.length > MAX_ROWS) {
      return { 
        error: `File contains ${rows.length} rows, which exceeds the maximum allowed ${MAX_ROWS} rows. Please split your file into smaller chunks.`, 
        data: null 
      }
    }

    const headerRow = (rows[0] || []).map((h) => (h || "").toLowerCase().trim())
    const dataRows = rows.slice(1)

    if (headerRow.length === 0) {
      return { error: "Invalid CSV format: missing header row", data: null }
    }

    // Find column indices
    const dateIndex = headerRow.findIndex((h) => h && (h.includes("date") || h.includes("transaction date")))
    const truckIndex = headerRow.findIndex(
      (h) => h && (h.includes("truck") || h.includes("unit") || h.includes("vehicle"))
    )
    const locationIndex = headerRow.findIndex((h) => h && (h.includes("location") || h.includes("station")))
    const stateIndex = headerRow.findIndex((h) => h && (h.includes("state") || h.includes("st")))
    const gallonsIndex = headerRow.findIndex((h) => h && (h.includes("gallon") || h.includes("quantity")))
    const productIndex = headerRow.findIndex((h) => h && (h.includes("product") || h.includes("fuel type") || h.includes("fuel")))
    const priceIndex = headerRow.findIndex(
      (h) => h && (h.includes("price") || h.includes("rate") || h.includes("per gallon"))
    )
    const totalIndex = headerRow.findIndex((h) => h && (h.includes("total") || h.includes("amount")))

    if (dateIndex === -1 || gallonsIndex === -1 || totalIndex === -1) {
      return {
        error: "Required columns not found. Expected: Date, Gallons, Total",
        data: null,
      }
    }

    const importResult: FuelCardImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      imported: [],
    }

    // Get all trucks for matching
    const { data: trucks } = await supabase
      .from("trucks")
      .select("id, truck_number, driver_id")
      .eq("company_id", ctx.companyId)

    const truckMap = new Map<string, string>()
    const truckDriverMap = new Map<string, string | null>()
    trucks?.forEach((truck: { id: string; truck_number: string | null; driver_id: string | null }) => {
      if (truck.truck_number) {
        truckMap.set(truck.truck_number.toLowerCase(), truck.id)
      }
      truckDriverMap.set(truck.id, truck.driver_id || null)
    })

    const avgTransactionCache = new Map<string, number>()
    const getDriverAvgTransaction = async (driverId: string | null): Promise<number> => {
      if (!driverId) return 0
      if (avgTransactionCache.has(driverId)) return avgTransactionCache.get(driverId) || 0
      const { data } = await supabase
        .from("fuel_purchases")
        .select("total_cost")
        .eq("company_id", ctx.companyId)
        .eq("driver_id", driverId)
        .order("purchase_date", { ascending: false })
        .limit(30)
      const costs = (data || [])
        .map((row: NumericCostRow) => Number(row.total_cost || 0))
        .filter((value: number) => value > 0)
      const avg = costs.length > 0 ? costs.reduce((sum: number, value: number) => sum + value, 0) / costs.length : 0
      avgTransactionCache.set(driverId, avg)
      return avg
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      if (row.length < Math.max(dateIndex, gallonsIndex, totalIndex) + 1) {
        importResult.failed++
        importResult.errors.push({ row: i + 2, error: "Insufficient columns" })
        continue
      }

      try {
        // Parse date
        const dateStr = row[dateIndex]?.trim()
        if (!dateStr) {
          importResult.failed++
          importResult.errors.push({ row: i + 2, error: "Missing date" })
          continue
        }

        let purchaseDate: Date
        if (dateStr.includes("/")) {
          // MM/DD/YYYY or M/D/YYYY
          const parts = dateStr.split("/")
          if (parts.length !== 3) {
            importResult.failed++
            importResult.errors.push({ row: i + 2, error: `Invalid date format: ${dateStr}` })
            continue
          }
          const year = parseInt(parts[2])
          const month = parseInt(parts[0]) - 1
          const day = parseInt(parts[1])
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            importResult.failed++
            importResult.errors.push({ row: i + 2, error: `Invalid date values: ${dateStr}` })
            continue
          }
          purchaseDate = new Date(year, month, day)
        } else {
          purchaseDate = new Date(dateStr)
        }

        if (isNaN(purchaseDate.getTime())) {
          importResult.failed++
          importResult.errors.push({ row: i + 2, error: `Invalid date: ${dateStr}` })
          continue
        }

        // Parse gallons
        const gallonsStr = row[gallonsIndex]?.replace(/[^0-9.]/g, "") || "0"
        const gallons = parseFloat(gallonsStr)
        if (isNaN(gallons) || gallons <= 0) {
          importResult.failed++
          importResult.errors.push({ row: i + 2, error: `Invalid gallons: ${row[gallonsIndex]}` })
          continue
        }

        // Parse total cost
        const totalStr = row[totalIndex]?.replace(/[^0-9.]/g, "") || "0"
        const totalCost = parseFloat(totalStr)
        if (isNaN(totalCost) || totalCost <= 0) {
          importResult.failed++
          importResult.errors.push({ row: i + 2, error: `Invalid total: ${row[totalIndex]}` })
          continue
        }

        // Calculate price per gallon
        const pricePerGallon = totalCost / gallons

        // Parse state
        let state = row[stateIndex]?.trim().toUpperCase() || ""
        if (!state && locationIndex !== -1) {
          // Try to extract state from location
          const location = row[locationIndex]?.trim() || ""
          if (location && typeof location === 'string') {
            const stateMatch = location.match(/\b([A-Z]{2})\b/)
            if (stateMatch && stateMatch[1]) {
              state = stateMatch[1]
            }
          }
        }

        if (!state || state.length !== 2) {
          importResult.failed++
          importResult.errors.push({ row: i + 2, error: `Invalid state: ${row[stateIndex] || "missing"}` })
          continue
        }

        // Find truck ID
        let truckId: string | null = null
        if (truckIndex !== -1) {
          const truckNumber = row[truckIndex]?.trim() || ""
          if (truckNumber) {
            truckId = truckMap.get(truckNumber.toLowerCase()) || null
          }
        }

        const productType = productIndex !== -1 ? row[productIndex]?.trim() || null : null
        const driverId: string | null = truckId ? truckDriverMap.get(truckId) || null : null
        const driverAvgTransaction = await getDriverAvgTransaction(driverId)
        const isAmountAnomalous = driverAvgTransaction > 0 && totalCost > driverAvgTransaction * 2
        const isProductAnomalous = isUnexpectedProductType(productType)
        const transactionId = `COMDATA-${i + 1}`

        // Insert fuel purchase
        const { error: insertError } = await supabase.from("fuel_purchases").insert({
          company_id: ctx.companyId,
          truck_id: truckId,
          driver_id: driverId,
          purchase_date: purchaseDate.toISOString().split("T")[0],
          state: state,
          city: locationIndex !== -1 ? row[locationIndex]?.trim() : null,
          station_name: locationIndex !== -1 ? row[locationIndex]?.trim() : null,
          gallons: gallons,
          price_per_gallon: pricePerGallon,
          total_cost: totalCost,
          receipt_number: transactionId,
          notes: `Imported from Comdata file: ${fileName}`,
        })

        if (insertError) {
          importResult.failed++
          importResult.errors.push({ row: i + 2, error: insertError.message })
        } else {
          importResult.success++
          importResult.imported.push({
            purchase_date: purchaseDate.toISOString().split("T")[0],
            state: state,
            gallons: gallons,
            total_cost: totalCost,
            truck_number: truckIndex !== -1 ? row[truckIndex]?.trim() : undefined,
          })

          if (isAmountAnomalous || isProductAnomalous) {
            runAgentEvaluation({
              companyId: ctx.companyId,
              trigger: "fuel_anomaly",
              triggerData: {
                transactionId,
                driverId,
                truckId,
                amount: totalCost,
                gallons,
                location: locationIndex !== -1 ? row[locationIndex]?.trim() || null : null,
                productType: productType || "unknown",
                driverAvgTransaction,
              },
              contextTypes: ["fleet", "driver"],
            }).catch((err) => console.error("[Agent]", err))
          }
        }
      } catch (error: unknown) {
        importResult.failed++
        importResult.errors.push({ row: i + 2, error: errorMessage(error, "Unknown error") })
      }
    }

    revalidatePath("/dashboard/accounting/tax-fuel")
    return { data: importResult, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to import fuel data"
    return { error: message, data: null }
  }
}

/**
 * Import Wex fuel card data
 * Expected format: Date, Vehicle ID, Location, State, Gallons, Price/Gallon, Total
 */
export async function importWexFuelData(
  fileContent: string,
  fileName: string
): Promise<{
  data: FuelCardImportResult | null
  error: string | null
}> {
  // Wex format is similar to Comdata, reuse the logic
  return importComdataFuelData(fileContent, fileName)
}

/**
 * Import P-Fleet fuel card data
 * Expected format: Date, Unit Number, Location, State, Gallons, Price/Gallon, Total
 */
export async function importPFleetFuelData(
  fileContent: string,
  fileName: string
): Promise<{
  data: FuelCardImportResult | null
  error: string | null
}> {
  // P-Fleet format is similar to Comdata, reuse the logic
  return importComdataFuelData(fileContent, fileName)
}

/**
 * Generic fuel card import (auto-detect format)
 */
export async function importFuelCardData(
  fileContent: string,
  fileName: string,
  provider: "comdata" | "wex" | "pfleet" | "efs" | "auto"
): Promise<{
  data: FuelCardImportResult | null
  error: string | null
}> {
  if (provider === "comdata") {
    return importComdataFuelData(fileContent, fileName)
  } else if (provider === "wex") {
    return importWexFuelData(fileContent, fileName)
  } else if (provider === "pfleet") {
    return importPFleetFuelData(fileContent, fileName)
  } else if (provider === "efs") {
    return importComdataFuelData(fileContent, fileName)
  } else {
    // Auto-detect: try Comdata format first
    return importComdataFuelData(fileContent, fileName)
  }
}

type LiveFuelProvider = "comdata" | "wex" | "efs"

type NormalizedFuelTxn = {
  external_transaction_id: string
  transaction_date: string
  posted_date?: string | null
  truck_number?: string | null
  driver_external_id?: string | null
  card_number_last4?: string | null
  merchant_name?: string | null
  merchant_city?: string | null
  merchant_state?: string | null
  gallons: number
  price_per_gallon?: number | null
  total_amount: number
  odometer?: number | null
  raw_payload: unknown
}

type ProviderRow = Record<string, unknown>
type NumericCostRow = { total_cost?: number | string | null }
type ProviderIntegrationConfigRow = {
  comdata_enabled?: unknown
  comdata_api_base_url?: unknown
  comdata_api_key?: unknown
  comdata_api_secret?: unknown
  wex_enabled?: unknown
  wex_api_base_url?: unknown
  wex_api_key?: unknown
  wex_api_secret?: unknown
  efs_enabled?: unknown
  efs_api_base_url?: unknown
  efs_api_key?: unknown
  efs_api_secret?: unknown
}

const asProviderRow = (value: unknown): ProviderRow =>
  value && typeof value === "object" ? (value as ProviderRow) : {}

function getProviderRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const payloadObj = asProviderRow(payload)
  const transactions = payloadObj.transactions
  if (Array.isArray(transactions)) return transactions
  const data = payloadObj.data
  if (Array.isArray(data)) return data
  return []
}

function normalizeComdataTxns(payload: unknown): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: unknown, idx: number) => {
      const rowObj = asProviderRow(row)
      const transactionDate = String(rowObj.transaction_date || rowObj.date || rowObj.purchase_date || "").slice(0, 10)
      const total = Number(rowObj.total_amount ?? rowObj.total ?? rowObj.amount ?? 0)
      const gallons = Number(rowObj.gallons ?? rowObj.qty ?? rowObj.quantity ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(rowObj.id || rowObj.transaction_id || rowObj.reference || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: rowObj.posted_date ? String(rowObj.posted_date).slice(0, 10) : null,
        truck_number: rowObj.truck_number || rowObj.unit_number || null,
        driver_external_id: rowObj.driver_id || rowObj.employee_id || null,
        card_number_last4: rowObj.card_last4 || rowObj.card_number_last4 || null,
        merchant_name: rowObj.merchant_name || rowObj.location || null,
        merchant_city: rowObj.merchant_city || rowObj.city || null,
        merchant_state: rowObj.merchant_state || rowObj.state || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(rowObj.price_per_gallon ?? rowObj.ppg))
          ? Number(rowObj.price_per_gallon ?? rowObj.ppg)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(rowObj.odometer)) ? Number(rowObj.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

function normalizeWexTxns(payload: unknown): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: unknown, idx: number) => {
      const rowObj = asProviderRow(row)
      const transactionDate = String(rowObj.transactionDate || rowObj.date || rowObj.purchaseDate || "").slice(0, 10)
      const total = Number(rowObj.totalAmount ?? rowObj.amount ?? 0)
      const gallons = Number(rowObj.fuelQty ?? rowObj.gallons ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(rowObj.transactionId || rowObj.id || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: rowObj.postedDate ? String(rowObj.postedDate).slice(0, 10) : null,
        truck_number: rowObj.unitNumber || rowObj.truckNumber || null,
        driver_external_id: rowObj.driverId || null,
        card_number_last4: rowObj.cardLast4 || null,
        merchant_name: rowObj.merchantName || rowObj.merchant || null,
        merchant_city: rowObj.city || rowObj.merchantCity || null,
        merchant_state: rowObj.state || rowObj.merchantState || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(rowObj.pricePerGallon))
          ? Number(rowObj.pricePerGallon)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(rowObj.odometer)) ? Number(rowObj.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

function normalizeEfsTxns(payload: unknown): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: unknown, idx: number) => {
      const rowObj = asProviderRow(row)
      const transactionDate = String(rowObj.txn_date || rowObj.transaction_date || rowObj.date || "").slice(0, 10)
      const total = Number(rowObj.net_amount ?? rowObj.total_amount ?? rowObj.amount ?? 0)
      const gallons = Number(rowObj.gallons ?? rowObj.quantity ?? rowObj.qty ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(rowObj.transaction_id || rowObj.id || rowObj.reference_number || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: rowObj.posted_date ? String(rowObj.posted_date).slice(0, 10) : null,
        truck_number: rowObj.truck_id || rowObj.unit_number || null,
        driver_external_id: rowObj.driver_id || null,
        card_number_last4: rowObj.card_last4 || rowObj.card_suffix || null,
        merchant_name: rowObj.merchant_name || rowObj.location_name || null,
        merchant_city: rowObj.city || null,
        merchant_state: rowObj.state || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(rowObj.price_per_gallon))
          ? Number(rowObj.price_per_gallon)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(rowObj.odometer)) ? Number(rowObj.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

function normalizeLiveTxns(payload: unknown, provider: LiveFuelProvider): NormalizedFuelTxn[] {
  if (provider === "comdata") return normalizeComdataTxns(payload)
  if (provider === "wex") return normalizeWexTxns(payload)
  return normalizeEfsTxns(payload)
}

function normalizeLiveTxnsLegacy(payload: unknown): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: unknown, idx: number) => {
      const rowObj = asProviderRow(row)
      const transactionDate = String(rowObj.transaction_date || rowObj.date || rowObj.purchase_date || "").slice(0, 10)
      const total = Number(rowObj.total_amount ?? rowObj.total ?? rowObj.amount ?? 0)
      const gallons = Number(rowObj.gallons ?? rowObj.qty ?? rowObj.quantity ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(rowObj.id || rowObj.transaction_id || rowObj.reference || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: rowObj.posted_date ? String(rowObj.posted_date).slice(0, 10) : null,
        truck_number: rowObj.truck_number || rowObj.unit_number || rowObj.vehicle || null,
        driver_external_id: rowObj.driver_id || rowObj.employee_id || null,
        card_number_last4: rowObj.card_last4 || rowObj.card_number_last4 || null,
        merchant_name: rowObj.merchant_name || rowObj.location || rowObj.station_name || null,
        merchant_city: rowObj.merchant_city || rowObj.city || null,
        merchant_state: rowObj.merchant_state || rowObj.state || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(rowObj.price_per_gallon ?? rowObj.ppg))
          ? Number(rowObj.price_per_gallon ?? rowObj.ppg)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(rowObj.odometer)) ? Number(rowObj.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

async function getLiveProviderConfig(provider: LiveFuelProvider) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("company_integrations")
    .select(`
      comdata_enabled, comdata_api_base_url, comdata_api_key, comdata_api_secret,
      wex_enabled, wex_api_base_url, wex_api_key, wex_api_secret,
      efs_enabled, efs_api_base_url, efs_api_key, efs_api_secret
    `)
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (error || !data) return { error: "Fuel-card integration is not configured", data: null }
  const configRow = data as ProviderIntegrationConfigRow

  const configByProvider: Record<LiveFuelProvider, { enabled: boolean; base_url: string; api_key: string; api_secret: string }> = {
    comdata: {
      enabled: !!configRow.comdata_enabled,
      base_url: String(configRow.comdata_api_base_url || ""),
      api_key: String(configRow.comdata_api_key || ""),
      api_secret: String(configRow.comdata_api_secret || ""),
    },
    wex: {
      enabled: !!configRow.wex_enabled,
      base_url: String(configRow.wex_api_base_url || ""),
      api_key: String(configRow.wex_api_key || ""),
      api_secret: String(configRow.wex_api_secret || ""),
    },
    efs: {
      enabled: !!configRow.efs_enabled,
      base_url: String(configRow.efs_api_base_url || ""),
      api_key: String(configRow.efs_api_key || ""),
      api_secret: String(configRow.efs_api_secret || ""),
    },
  }

  const providerConfig = configByProvider[provider]
  if (!providerConfig.enabled) return { error: `${provider.toUpperCase()} integration is not enabled`, data: null }
  if (!providerConfig.base_url || !providerConfig.api_key || !providerConfig.api_secret) {
    return { error: `${provider.toUpperCase()} API credentials are incomplete`, data: null }
  }
  return { error: null, data: { ...providerConfig, companyId: ctx.companyId } }
}

export async function syncFuelCardTransactions(provider: LiveFuelProvider, fromDate?: string, toDate?: string) {
  try {
    const supabase = await createClient()
    const cfg = await getLiveProviderConfig(provider)
    if (cfg.error || !cfg.data) return { error: cfg.error, data: null }

    const query = new URLSearchParams()
    if (fromDate) query.set("from", fromDate)
    if (toDate) query.set("to", toDate)
    query.set("provider", provider)

    const response = await fetch(`${cfg.data.base_url.replace(/\/+$/, "")}/transactions?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfg.data.api_key}`,
        "X-API-SECRET": cfg.data.api_secret,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!response.ok) {
      return { error: `${provider.toUpperCase()} API returned ${response.status}`, data: null }
    }

    const raw = await response.json().catch(() => ({}))
    const txns = normalizeLiveTxns(raw, provider)
    const normalizedTxns = txns.length > 0 ? txns : normalizeLiveTxnsLegacy(raw)
    if (normalizedTxns.length === 0) return { data: { inserted: 0, skipped: 0 }, error: null }

    const { data: trucks } = await supabase
      .from("trucks")
      .select("id, truck_number, driver_id")
      .eq("company_id", cfg.data.companyId)
      .limit(2000)
    const truckMap = new Map<string, string>()
    const truckDriverMap = new Map<string, string | null>()
    ;(trucks || []).forEach((t: { id: string; truck_number: string | null; driver_id: string | null }) => {
      if (t.truck_number) truckMap.set(String(t.truck_number).toLowerCase(), String(t.id))
      truckDriverMap.set(String(t.id), t.driver_id ? String(t.driver_id) : null)
    })

    const transactionRows = normalizedTxns.map((t) => ({
      company_id: cfg.data.companyId,
      provider,
      external_transaction_id: t.external_transaction_id,
      transaction_date: t.transaction_date,
      posted_date: t.posted_date || null,
      truck_id: t.truck_number ? truckMap.get(String(t.truck_number).toLowerCase()) || null : null,
      driver_id: null,
      card_number_last4: t.card_number_last4 || null,
      merchant_name: t.merchant_name || null,
      merchant_city: t.merchant_city || null,
      merchant_state: t.merchant_state || null,
      gallons: t.gallons,
      price_per_gallon: t.price_per_gallon ?? null,
      total_amount: t.total_amount,
      odometer: t.odometer ?? null,
      raw_payload: t.raw_payload || {},
    }))

    const upsertRes = await supabase
      .from("fuel_card_transactions")
      .upsert(transactionRows, { onConflict: "company_id,provider,external_transaction_id" })
    if (upsertRes.error) return { error: safeDbError(upsertRes.error, "Failed to sync fuel transactions"), data: null }

    // Mirror into fuel_purchases table so existing reports remain live.
    const purchaseRows = transactionRows.map((t) => ({
      company_id: t.company_id,
      truck_id: t.truck_id,
      driver_id: t.truck_id ? truckDriverMap.get(String(t.truck_id)) || null : null,
      purchase_date: t.transaction_date,
      state: t.merchant_state || "NA",
      city: t.merchant_city || null,
      station_name: t.merchant_name || `${provider.toUpperCase()} Merchant`,
      gallons: t.gallons,
      price_per_gallon: t.price_per_gallon || (t.total_amount / Math.max(t.gallons, 0.0001)),
      total_cost: t.total_amount,
      receipt_number: `${provider.toUpperCase()}-${t.external_transaction_id}`,
      notes: `Live API sync (${provider.toUpperCase()})`,
    }))
    const avgTransactionCache = new Map<string, number>()
    const getDriverAvgTransaction = async (driverId: string | null): Promise<number> => {
      if (!driverId) return 0
      if (avgTransactionCache.has(driverId)) return avgTransactionCache.get(driverId) || 0
      const { data } = await supabase
        .from("fuel_purchases")
        .select("total_cost")
        .eq("company_id", cfg.data.companyId)
        .eq("driver_id", driverId)
        .order("purchase_date", { ascending: false })
        .limit(30)
      const costs = (data || [])
        .map((row: NumericCostRow) => Number(row.total_cost || 0))
        .filter((value: number) => value > 0)
      const avg = costs.length > 0 ? costs.reduce((sum: number, value: number) => sum + value, 0) / costs.length : 0
      avgTransactionCache.set(driverId, avg)
      return avg
    }
    for (const row of purchaseRows) {
      const exists = await supabase
        .from("fuel_purchases")
        .select("id")
        .eq("company_id", row.company_id)
        .eq("receipt_number", row.receipt_number)
        .limit(1)
      if (exists.data && exists.data.length > 0) continue
      await supabase.from("fuel_purchases").insert(row)

      const sourceTxn = transactionRows.find((t) => `${provider.toUpperCase()}-${t.external_transaction_id}` === row.receipt_number)
      const productType =
        (sourceTxn?.raw_payload?.product_type as string | undefined) ||
        (sourceTxn?.raw_payload?.fuel_type as string | undefined) ||
        (sourceTxn?.raw_payload?.product as string | undefined) ||
        "unknown"
      const driverId = row.driver_id || null
      const driverAvgTransaction = await getDriverAvgTransaction(driverId)
      const amount = Number(row.total_cost || 0)
      const gallons = Number(row.gallons || 0)
      const isAmountAnomalous = driverAvgTransaction > 0 && amount > driverAvgTransaction * 2
      const isProductAnomalous = isUnexpectedProductType(productType)

      if (isAmountAnomalous || isProductAnomalous) {
        runAgentEvaluation({
          companyId: cfg.data.companyId,
          trigger: "fuel_anomaly",
          triggerData: {
            transactionId: row.receipt_number,
            driverId,
            truckId: row.truck_id || null,
            amount,
            gallons,
            location: [row.city, row.state].filter(Boolean).join(", ") || null,
            productType,
            driverAvgTransaction,
          },
          contextTypes: ["fleet", "driver"],
        }).catch((err) => console.error("[Agent]", err))
      }
    }

    await supabase
      .from("company_integrations")
      .update({ fuel_card_last_synced_at: new Date().toISOString() })
      .eq("company_id", cfg.data.companyId)

    revalidatePath("/dashboard/accounting/tax-fuel")
    return { data: { inserted: normalizedTxns.length, skipped: 0 }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to sync live fuel card transactions"), data: null }
  }
}

export async function syncAllEnabledFuelCardProviders() {
  const providers: LiveFuelProvider[] = ["comdata", "wex", "efs"]
  const out: Array<{ provider: LiveFuelProvider; success: boolean; error?: string; inserted?: number }> = []
  for (const provider of providers) {
    const result = await syncFuelCardTransactions(provider)
    out.push({ provider, success: !result.error, error: result.error || undefined, inserted: result.data?.inserted || 0 })
  }
  return { data: out, error: null }
}



