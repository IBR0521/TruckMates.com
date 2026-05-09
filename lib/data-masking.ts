import type { EmployeeRole } from "./roles"
import { isFeatureMasked } from "./feature-permissions"

type FinancialMaskable = {
  total_rate?: unknown
  value?: unknown
  rate?: unknown
  freight_charges?: unknown
  amount?: unknown
}

/**
 * Mask financial data for roles that should only see view-only rates
 */
export function maskFinancialData<T extends FinancialMaskable | null | undefined>(role: EmployeeRole, data: T): T {
  if (!data) return data

  // Check if accounting/financial features should be masked
  if (isFeatureMasked(role, "accounting")) {
    // Mask rate fields
    if (data.total_rate) {
      data.total_rate = "***"
    }
    if (data.value) {
      data.value = "***"
    }
    if (data.rate) {
      data.rate = "***"
    }
    if (data.freight_charges) {
      data.freight_charges = "***"
    }
    if (data.amount) {
      data.amount = "***"
    }
  }

  return data
}

/**
 * Mask financial fields in an array of items
 */
export function maskFinancialDataArray<T extends FinancialMaskable>(role: EmployeeRole, items: T[]): T[] {
  if (!items || !Array.isArray(items)) return items

  return items.map((item) => maskFinancialData(role, item))
}

/**
 * Format masked financial value for display
 */
export function formatMaskedValue(value: unknown): string {
  if (value === "***" || value === null || value === undefined) {
    return "$***"
  }
  return `$${Number(value).toLocaleString()}`
}















