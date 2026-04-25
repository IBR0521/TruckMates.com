"use server"

import * as Sentry from "@sentry/nextjs"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { fetchLatestUsDieselPrice } from "@/lib/promiles/eia-diesel"
import { EIA_US_DIESEL_DUOAREA } from "@/lib/promiles/padd-state-map"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_FSC_BASE_PRICE = 1.2
const DEFAULT_FSC_MPG = 6.5

export async function calculateAutoFuelSurchargePerMile(params: {
  currentPricePerGallon: number
  basePricePerGallon: number
  mpg: number
}): Promise<number> {
  const base = params.basePricePerGallon > 0 ? params.basePricePerGallon : DEFAULT_FSC_BASE_PRICE
  const mpg = params.mpg > 0 ? params.mpg : DEFAULT_FSC_MPG
  const spread = Math.max(params.currentPricePerGallon - base, 0)
  return Math.round((spread / mpg) * 10000) / 10000
}

export async function syncCurrentDieselPrice(): Promise<{
  data: { effective_date: string; price_per_gallon: number } | null
  error: string | null
}> {
  try {
    const apiKey = process.env.EIA_API_KEY
    if (!apiKey) return { data: null, error: "EIA_API_KEY is not configured" }

    const fetched = await fetchLatestUsDieselPrice(apiKey)
    if (fetched.error || fetched.price == null) {
      return { data: null, error: fetched.error || "Failed to fetch diesel price" }
    }

    const effectiveDate = new Date().toISOString().slice(0, 10)
    const admin = createAdminClient()
    const { error } = await admin.from("fuel_price_history").upsert(
      {
        source: "eia",
        series_id: "EPD2D",
        period: EIA_US_DIESEL_DUOAREA,
        effective_date: effectiveDate,
        price_per_gallon: fetched.price,
      },
      { onConflict: "source,series_id,effective_date" },
    )
    if (error) return { data: null, error: error.message }

    return { data: { effective_date: effectiveDate, price_per_gallon: fetched.price }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "Failed to sync diesel price") }
  }
}

export async function getCurrentDieselPrice(): Promise<{
  data: { price_per_gallon: number; effective_date: string } | null
  error: string | null
}> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { data: null, error: ctx.error || "Not authenticated" }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("fuel_price_history")
      .select("price_per_gallon, effective_date")
      .eq("source", "eia")
      .eq("series_id", "EPD2D")
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: "Unable to read diesel price history" }
    if (!data) return { data: null, error: "Diesel price has not been synced yet" }

    return {
      data: {
        price_per_gallon: Number(data.price_per_gallon || 0),
        effective_date: String(data.effective_date || ""),
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "Failed to get current diesel price") }
  }
}

