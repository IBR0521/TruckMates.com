import type { SupabaseClient } from "@supabase/supabase-js"

export type FuelSurchargeMethod = "none" | "flat-fee" | "percentage" | "per-mile"

export type FuelSurchargeSettings = {
  fuel_surcharge_method?: string | null
  default_fuel_surcharge_percentage?: number | null
  fuel_surcharge_flat_amount?: number | null
  fuel_surcharge_per_mile?: number | null
}

export type InvoiceTaxLine = {
  name: string
  rate: number
  tax_type: "percentage" | "fixed"
  amount: number
}

export type ResolvedInvoiceTaxes = {
  subtotal: number
  taxAmount: number
  total: number
  taxRate: number | null
  lines: InvoiceTaxLine[]
  taxInclusive: boolean
}

export type CompanyTaxDefaults = {
  tax_enabled?: boolean | null
  default_tax_rate?: number | null
  tax_inclusive?: boolean | null
  tax_name?: string | null
}

function normalizeMethod(raw: unknown): FuelSurchargeMethod {
  const m = String(raw || "percentage").toLowerCase()
  if (m === "none" || m === "flat-fee" || m === "per-mile" || m === "percentage") return m
  return "percentage"
}

/** Compute fuel surcharge from company settings and load inputs. */
export function calculateFuelSurcharge(
  settings: FuelSurchargeSettings,
  params: { rate?: number | null; estimatedMiles?: number | null; explicitSurcharge?: number | null },
): number {
  if (params.explicitSurcharge != null && Number(params.explicitSurcharge) > 0) {
    return Number(params.explicitSurcharge)
  }

  const method = normalizeMethod(settings.fuel_surcharge_method)
  const baseRate = Number(params.rate) || 0
  const miles = Number(params.estimatedMiles) || 0

  switch (method) {
    case "none":
      return 0
    case "flat-fee":
      return Math.round((Number(settings.fuel_surcharge_flat_amount) || 0) * 100) / 100
    case "per-mile":
      return Math.round((Number(settings.fuel_surcharge_per_mile) || 0) * miles * 100) / 100
    case "percentage":
    default: {
      const pct = Number(settings.default_fuel_surcharge_percentage) || 0
      if (!pct || !baseRate) return 0
      return Math.round((baseRate * pct) / 100 * 100) / 100
    }
  }
}

type InvoiceTaxRow = {
  name: string
  rate: number
  tax_type: string
  is_default?: boolean | null
  is_active?: boolean | null
  applies_to: string
  state_codes?: string[] | null
  customer_ids?: string[] | null
}

function taxApplies(row: InvoiceTaxRow, customerId?: string | null, stateCode?: string | null): boolean {
  if (row.is_active === false) return false
  const appliesTo = String(row.applies_to || "all")
  if (appliesTo === "all") return true
  if (appliesTo === "specific_states") {
    const states = (row.state_codes || []).map((s) => String(s).toUpperCase())
    return stateCode ? states.includes(String(stateCode).toUpperCase()) : false
  }
  if (appliesTo === "specific_customers") {
    const ids = (row.customer_ids || []).map(String)
    return customerId ? ids.includes(String(customerId)) : false
  }
  return false
}

/** Resolve invoice taxes from company_invoice_taxes with fallback to default tax settings. */
export async function resolveInvoiceTaxes(
  supabase: SupabaseClient,
  companyId: string,
  amount: number,
  options?: {
    customerId?: string | null
    stateCode?: string | null
    defaults?: CompanyTaxDefaults | null
  },
): Promise<ResolvedInvoiceTaxes> {
  const defaults = options?.defaults ?? {}
  const taxInclusive = Boolean(defaults.tax_inclusive)
  let subtotal = amount
  let total = amount
  const lines: InvoiceTaxLine[] = []

  const { data: taxRows } = await supabase
    .from("company_invoice_taxes")
    .select("name, rate, tax_type, is_default, is_active, applies_to, state_codes, customer_ids, display_order")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })

  const applicable = ((taxRows || []) as InvoiceTaxRow[]).filter((row) =>
    taxApplies(row, options?.customerId, options?.stateCode),
  )

  if (applicable.length === 0) {
    if (defaults.tax_enabled && defaults.default_tax_rate) {
      const rate = Number(defaults.default_tax_rate)
      const name = String(defaults.tax_name || "Tax")
      if (taxInclusive) {
        subtotal = Math.round((amount / (1 + rate / 100)) * 100) / 100
        const taxAmount = Math.round((amount - subtotal) * 100) / 100
        lines.push({ name, rate, tax_type: "percentage", amount: taxAmount })
        return { subtotal, taxAmount, total: amount, taxRate: rate, lines, taxInclusive }
      }
      const taxAmount = Math.round((amount * rate) / 100 * 100) / 100
      total = Math.round((amount + taxAmount) * 100) / 100
      lines.push({ name, rate, tax_type: "percentage", amount: taxAmount })
      return { subtotal: amount, taxAmount, total, taxRate: rate, lines, taxInclusive: false }
    }
    return { subtotal: amount, taxAmount: 0, total: amount, taxRate: null, lines, taxInclusive }
  }

  let taxAmount = 0
  for (const row of applicable) {
    const rate = Number(row.rate) || 0
    if (row.tax_type === "fixed") {
      taxAmount += rate
      lines.push({ name: row.name, rate, tax_type: "fixed", amount: rate })
    } else {
      const lineAmount = Math.round((subtotal * rate) / 100 * 100) / 100
      taxAmount += lineAmount
      lines.push({ name: row.name, rate, tax_type: "percentage", amount: lineAmount })
    }
  }
  taxAmount = Math.round(taxAmount * 100) / 100
  if (taxInclusive) {
    return { subtotal, taxAmount, total: amount, taxRate: null, lines, taxInclusive: true }
  }
  total = Math.round((subtotal + taxAmount) * 100) / 100
  return { subtotal, taxAmount, total, taxRate: null, lines, taxInclusive: false }
}
