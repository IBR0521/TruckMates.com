"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const rows = parseCSV(fileContent)
    if (rows.length < 2) {
      return { error: "CSV file must have at least a header row and one data row", data: null }
    }

    const headerRow = rows[0].map((h) => h.toLowerCase().trim())
    const dataRows = rows.slice(1)

    // Find column indices
    const dateIndex = headerRow.findIndex((h) => h.includes("date") || h.includes("transaction date"))
    const truckIndex = headerRow.findIndex(
      (h) => h.includes("truck") || h.includes("unit") || h.includes("vehicle")
    )
    const locationIndex = headerRow.findIndex((h) => h.includes("location") || h.includes("station"))
    const stateIndex = headerRow.findIndex((h) => h.includes("state") || h.includes("st"))
    const gallonsIndex = headerRow.findIndex((h) => h.includes("gallon") || h.includes("quantity"))
    const priceIndex = headerRow.findIndex(
      (h) => h.includes("price") || h.includes("rate") || h.includes("per gallon")
    )
    const totalIndex = headerRow.findIndex((h) => h.includes("total") || h.includes("amount"))

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
      .eq("company_id", result.company_id)

    const truckMap = new Map<string, string>()
    trucks?.forEach((truck) => {
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
          purchaseDate = new Date(
            parseInt(parts[2]),
            parseInt(parts[0]) - 1,
            parseInt(parts[1])
          )
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
          const stateMatch = location.match(/\b([A-Z]{2})\b/)
          if (stateMatch) {
            state = stateMatch[1]
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
          company_id: result.company_id,
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
      } catch (error: any) {
        importResult.failed++
        importResult.errors.push({ row: i + 2, error: error.message || "Unknown error" })
      }
    }

    revalidatePath("/dashboard/accounting/tax-fuel")
    return { data: importResult, error: null }
  } catch (error: any) {
    console.error("Error importing Comdata fuel data:", error)
    return { error: error.message || "Failed to import fuel data", data: null }
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
  provider: "comdata" | "wex" | "pfleet" | "auto"
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
  } else {
    // Auto-detect: try Comdata format first
    return importComdataFuelData(fileContent, fileName)
  }
}



