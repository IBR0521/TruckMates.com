/**
 * Format utilities that use company settings for currency, dates, etc.
 */

import { getCompanySettings } from "@/app/actions/number-formats"

/**
 * Format currency based on company settings
 */
export async function formatCurrency(amount: number): Promise<string> {
  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || {}
  const symbol = settings.currency_symbol || "$"
  const currency = settings.currency || "USD"
  
  // Format number based on number_format setting
  const numberFormat = settings.number_format || "1,234.56"
  let formattedAmount: string
  
  if (numberFormat === "1.234,56") {
    // European format
    formattedAmount = amount.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  } else if (numberFormat === "1 234,56") {
    // French format
    formattedAmount = amount.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  } else {
    // US format (default)
    formattedAmount = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }
  
  // Currency symbol placement (most currencies use prefix, some use suffix)
  if (currency === "USD" || currency === "EUR" || currency === "GBP" || currency === "CAD" || currency === "AUD" || currency === "MXN") {
    return `${symbol}${formattedAmount}`
  } else {
    return `${formattedAmount} ${symbol}`
  }
}

/**
 * Format date based on company settings
 */
export async function formatDate(date: Date | string): Promise<string> {
  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || {}
  const dateFormat = settings.date_format || "MM/DD/YYYY"
  
  const d = typeof date === "string" ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  
  switch (dateFormat) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`
    case "DD.MM.YYYY":
      return `${day}.${month}.${year}`
    default: // MM/DD/YYYY
      return `${month}/${day}/${year}`
  }
}

/**
 * Format time based on company settings
 */
export async function formatTime(date: Date | string): Promise<string> {
  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || {}
  const timeFormat = settings.time_format || "12h"
  
  const d = typeof date === "string" ? new Date(date) : date
  const hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, "0")
  
  if (timeFormat === "24h") {
    return `${String(hours).padStart(2, "0")}:${minutes}`
  } else {
    // 12-hour format
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes} ${period}`
  }
}

/**
 * Format date and time together
 */
export async function formatDateTime(date: Date | string): Promise<string> {
  const [dateStr, timeStr] = await Promise.all([
    formatDate(date),
    formatTime(date),
  ])
  return `${dateStr} ${timeStr}`
}



