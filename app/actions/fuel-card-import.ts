"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"

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
      .select("id, truck_number")
      .eq("company_id", ctx.companyId)

    const truckMap = new Map<string, string>()
    trucks?.forEach((truck: { id: string; truck_number: string | null }) => {
      if (truck.truck_number) {
        truckMap.set(truck.truck_number.toLowerCase(), truck.id)
      }
    })

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

        // Insert fuel purchase
        const { error: insertError } = await supabase.from("fuel_purchases").insert({
          company_id: ctx.companyId,
          truck_id: truckId,
          purchase_date: purchaseDate.toISOString().split("T")[0],
          state: state,
          city: locationIndex !== -1 ? row[locationIndex]?.trim() : null,
          station_name: locationIndex !== -1 ? row[locationIndex]?.trim() : null,
          gallons: gallons,
          price_per_gallon: pricePerGallon,
          total_cost: totalCost,
          receipt_number: `COMDATA-${i + 1}`,
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
  raw_payload: any
}

function getProviderRows(payload: any): any[] {
  return Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.transactions)
      ? payload.transactions
      : Array.isArray(payload?.data)
        ? payload.data
        : []
}

function normalizeComdataTxns(payload: any): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: any, idx: number) => {
      const transactionDate = String(row.transaction_date || row.date || row.purchase_date || "").slice(0, 10)
      const total = Number(row.total_amount ?? row.total ?? row.amount ?? 0)
      const gallons = Number(row.gallons ?? row.qty ?? row.quantity ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(row.id || row.transaction_id || row.reference || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: row.posted_date ? String(row.posted_date).slice(0, 10) : null,
        truck_number: row.truck_number || row.unit_number || null,
        driver_external_id: row.driver_id || row.employee_id || null,
        card_number_last4: row.card_last4 || row.card_number_last4 || null,
        merchant_name: row.merchant_name || row.location || null,
        merchant_city: row.merchant_city || row.city || null,
        merchant_state: row.merchant_state || row.state || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(row.price_per_gallon ?? row.ppg))
          ? Number(row.price_per_gallon ?? row.ppg)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(row.odometer)) ? Number(row.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

function normalizeWexTxns(payload: any): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: any, idx: number) => {
      const transactionDate = String(row.transactionDate || row.date || row.purchaseDate || "").slice(0, 10)
      const total = Number(row.totalAmount ?? row.amount ?? 0)
      const gallons = Number(row.fuelQty ?? row.gallons ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(row.transactionId || row.id || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: row.postedDate ? String(row.postedDate).slice(0, 10) : null,
        truck_number: row.unitNumber || row.truckNumber || null,
        driver_external_id: row.driverId || null,
        card_number_last4: row.cardLast4 || null,
        merchant_name: row.merchantName || row.merchant || null,
        merchant_city: row.city || row.merchantCity || null,
        merchant_state: row.state || row.merchantState || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(row.pricePerGallon))
          ? Number(row.pricePerGallon)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(row.odometer)) ? Number(row.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

function normalizeEfsTxns(payload: any): NormalizedFuelTxn[] {
  const rawRows = getProviderRows(payload)
  return rawRows
    .map((row: any, idx: number) => {
      const transactionDate = String(row.txn_date || row.transaction_date || row.date || "").slice(0, 10)
      const total = Number(row.net_amount ?? row.total_amount ?? row.amount ?? 0)
      const gallons = Number(row.gallons ?? row.quantity ?? row.qty ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(row.transaction_id || row.id || row.reference_number || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: row.posted_date ? String(row.posted_date).slice(0, 10) : null,
        truck_number: row.truck_id || row.unit_number || null,
        driver_external_id: row.driver_id || null,
        card_number_last4: row.card_last4 || row.card_suffix || null,
        merchant_name: row.merchant_name || row.location_name || null,
        merchant_city: row.city || null,
        merchant_state: row.state || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(row.price_per_gallon))
          ? Number(row.price_per_gallon)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(row.odometer)) ? Number(row.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

function normalizeLiveTxns(payload: any, provider: LiveFuelProvider): NormalizedFuelTxn[] {
  if (provider === "comdata") return normalizeComdataTxns(payload)
  if (provider === "wex") return normalizeWexTxns(payload)
  return normalizeEfsTxns(payload)
}

function normalizeLiveTxnsLegacy(payload: any): NormalizedFuelTxn[] {
  const rawRows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.transactions)
      ? payload.transactions
      : Array.isArray(payload?.data)
        ? payload.data
        : []
  return rawRows
    .map((row: any, idx: number) => {
      const transactionDate = String(row.transaction_date || row.date || row.purchase_date || "").slice(0, 10)
      const total = Number(row.total_amount ?? row.total ?? row.amount ?? 0)
      const gallons = Number(row.gallons ?? row.qty ?? row.quantity ?? 0)
      if (!transactionDate || !Number.isFinite(total) || total <= 0 || !Number.isFinite(gallons) || gallons <= 0) return null
      return {
        external_transaction_id: String(row.id || row.transaction_id || row.reference || `txn-${idx}`),
        transaction_date: transactionDate,
        posted_date: row.posted_date ? String(row.posted_date).slice(0, 10) : null,
        truck_number: row.truck_number || row.unit_number || row.vehicle || null,
        driver_external_id: row.driver_id || row.employee_id || null,
        card_number_last4: row.card_last4 || row.card_number_last4 || null,
        merchant_name: row.merchant_name || row.location || row.station_name || null,
        merchant_city: row.merchant_city || row.city || null,
        merchant_state: row.merchant_state || row.state || null,
        gallons,
        price_per_gallon: Number.isFinite(Number(row.price_per_gallon ?? row.ppg))
          ? Number(row.price_per_gallon ?? row.ppg)
          : Number.isFinite(total / gallons)
            ? total / gallons
            : null,
        total_amount: total,
        odometer: Number.isFinite(Number(row.odometer)) ? Number(row.odometer) : null,
        raw_payload: row,
      } as NormalizedFuelTxn
    })
    .filter(Boolean) as NormalizedFuelTxn[]
}

async function getLiveProviderConfig(provider: LiveFuelProvider) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null as any }

  const { data, error } = await supabase
    .from("company_integrations")
    .select(`
      comdata_enabled, comdata_api_base_url, comdata_api_key, comdata_api_secret,
      wex_enabled, wex_api_base_url, wex_api_key, wex_api_secret,
      efs_enabled, efs_api_base_url, efs_api_key, efs_api_secret
    `)
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (error || !data) return { error: "Fuel-card integration is not configured", data: null as any }

  const configByProvider: Record<LiveFuelProvider, { enabled: boolean; base_url: string; api_key: string; api_secret: string }> = {
    comdata: {
      enabled: !!(data as any).comdata_enabled,
      base_url: String((data as any).comdata_api_base_url || ""),
      api_key: String((data as any).comdata_api_key || ""),
      api_secret: String((data as any).comdata_api_secret || ""),
    },
    wex: {
      enabled: !!(data as any).wex_enabled,
      base_url: String((data as any).wex_api_base_url || ""),
      api_key: String((data as any).wex_api_key || ""),
      api_secret: String((data as any).wex_api_secret || ""),
    },
    efs: {
      enabled: !!(data as any).efs_enabled,
      base_url: String((data as any).efs_api_base_url || ""),
      api_key: String((data as any).efs_api_key || ""),
      api_secret: String((data as any).efs_api_secret || ""),
    },
  }

  const providerConfig = configByProvider[provider]
  if (!providerConfig.enabled) return { error: `${provider.toUpperCase()} integration is not enabled`, data: null as any }
  if (!providerConfig.base_url || !providerConfig.api_key || !providerConfig.api_secret) {
    return { error: `${provider.toUpperCase()} API credentials are incomplete`, data: null as any }
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
      .select("id, truck_number")
      .eq("company_id", cfg.data.companyId)
      .limit(2000)
    const truckMap = new Map<string, string>()
    ;(trucks || []).forEach((t: any) => {
      if (t.truck_number) truckMap.set(String(t.truck_number).toLowerCase(), String(t.id))
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
    if (upsertRes.error) return { error: upsertRes.error.message, data: null }

    // Mirror into fuel_purchases table so existing reports remain live.
    const purchaseRows = transactionRows.map((t) => ({
      company_id: t.company_id,
      truck_id: t.truck_id,
      driver_id: null,
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
    for (const row of purchaseRows) {
      const exists = await supabase
        .from("fuel_purchases")
        .select("id")
        .eq("company_id", row.company_id)
        .eq("receipt_number", row.receipt_number)
        .limit(1)
      if (exists.data && exists.data.length > 0) continue
      await supabase.from("fuel_purchases").insert(row)
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



