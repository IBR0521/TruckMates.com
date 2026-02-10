import type { EmployeeRole } from "./roles"
import { isFeatureMasked } from "./feature-permissions"

/**
 * Mask financial data for roles that should only see view-only rates
 */
export function maskFinancialData(role: EmployeeRole, data: any): any {
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
export function maskFinancialDataArray(role: EmployeeRole, items: any[]): any[] {
  if (!items || !Array.isArray(items)) return items

  return items.map((item) => maskFinancialData(role, item))
}

/**
 * Format masked financial value for display
 */
export function formatMaskedValue(value: any): string {
  if (value === "***" || value === null || value === undefined) {
    return "$***"
  }
  return `$${Number(value).toLocaleString()}`
}

