/**
 * Driver home dashboard — compliance-first snapshot (HOS, load, DVIR, violations).
 * Populated by `getDriverDashboardSnapshot` for users with role `driver`.
 */

export type DriverHosSeverity = "ok" | "warning" | "violation"

export type DriverDashboardHos = {
  currentDutyStatus: string
  remainingDriveHours: number
  remainingShiftHours: number
  remainingCycleHours: number
  needsBreak: boolean
  canDrive: boolean
  violations: string[]
  severity: DriverHosSeverity
}

export type DriverDashboardActiveLoad = {
  id: string
  shipment_number: string | null
  origin: string | null
  destination: string | null
  status: string | null
  load_date: string | null
  estimated_delivery: string | null
  pickup_time: string | null
  delivery_time: string | null
  special_instructions: string | null
}

export type DriverDashboardDvir = {
  preTripCompletedToday: boolean
  postTripCompletedToday: boolean
  /** Show post-trip CTA when driver is off duty and pre-trip is done but post-trip is not */
  postTripPrompt: boolean
}

export type DriverViolationItem = {
  title: string
  event_time: string
  severity: string | null
}

export type DriverDashboardSnapshot = {
  driverId: string | null
  /** When `driverId` is null: why auto-provisioning failed or what to do next */
  driverProvisionNote?: string | null
  hos: DriverDashboardHos | null
  activeLoad: DriverDashboardActiveLoad | null
  dvir: DriverDashboardDvir
  violations24h: {
    count: number
    items: DriverViolationItem[]
  }
}
