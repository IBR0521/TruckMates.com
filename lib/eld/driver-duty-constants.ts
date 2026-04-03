/** FMCSA duty statuses for web/mobile ELD — lives outside `"use server"` files (Next.js export rules). */
export const DRIVER_DUTY_LOG_TYPES = [
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty",
] as const

export type DriverDutyLogType = (typeof DRIVER_DUTY_LOG_TYPES)[number]
