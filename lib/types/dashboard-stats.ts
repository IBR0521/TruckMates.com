/**
 * Contract for `getDashboardStats` — use this in UI and cache instead of `any`
 * so refactors to DB columns surface at compile time where possible.
 */

export type DashboardActivityItem = {
  action: string
  time: string
  type: string
}

export type RevenueTrendPoint = {
  date: string
  amount: number
}

export type LoadStatusDistributionItem = {
  status: string
  count: number
}

/** Rows returned from lightweight “recent activity” list queries */
export type RecentLoadActivityRow = {
  shipment_number?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentDriverActivityRow = {
  name?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentMaintenanceActivityRow = {
  service_type?: string | null
  scheduled_date?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentRouteActivityRow = {
  name?: string | null
  created_at?: string | null
  updated_at?: string | null
  status?: string | null
}

export type RecentInvoiceActivityRow = {
  invoice_number?: string | null
  created_at?: string | null
  status?: string | null
  amount?: string | number | null
}

export type RecentSettlementActivityRow = {
  created_at?: string | null
  status?: string | null
  net_pay?: string | number | null
  drivers?: { name?: string | null } | null
}

export type RecentAddressBookActivityRow = {
  name?: string | null
  created_at?: string | null
  category?: string | null
}

export type RecentTruckActivityRow = {
  truck_number?: string | null
  make?: string | null
  model?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentCustomerActivityRow = {
  name?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentVendorActivityRow = {
  name?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentDocumentActivityRow = {
  name?: string | null
  created_at?: string | null
  document_type?: string | null
}

export type RecentBolActivityRow = {
  bol_number?: string | null
  created_at?: string | null
  status?: string | null
}

export type RecentDvirActivityRow = {
  created_at?: string | null
  status?: string | null
}

export type RecentGeofenceActivityRow = {
  name?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

/** Card strip samples (ids + labels) — optional fields vary by query */
export type DashboardCardDriverRow = {
  id?: string
  name?: string | null
  status?: string | null
  phone?: string | null
}

export type DashboardCardTruckRow = {
  id?: string
  truck_number?: string | null
  make?: string | null
  model?: string | null
  status?: string | null
}

export type DashboardCardRouteRow = {
  id?: string
  name?: string | null
  origin?: string | null
  destination?: string | null
  status?: string | null
}

export type DashboardCardLoadRow = {
  id?: string
  shipment_number?: string | null
  origin?: string | null
  destination?: string | null
  status?: string | null
}

export type InvoiceAmountRow = {
  amount?: string | number | null
  created_at?: string | null
  issue_date?: string | null
}

export type ExpenseAmountRow = {
  amount?: string | number | null
  date?: string | null
}

export type LoadRevenueRow = {
  total_rate?: string | number | null
  value?: string | number | null
  created_at?: string | null
}

export type LoadStatusRow = {
  status?: string | null
}

/** Matches `AlertsSection` + Supabase select lists (strict ids for keys) */
export type MaintenanceAlertRow = {
  id: string
  service_type: string
  scheduled_date: string
  status: string
}

export type OverdueInvoiceAlertRow = {
  id: string
  invoice_number: string
  due_date: string
  amount: number | string
  status: string
}

export type UpcomingDeliveryRow = {
  id: string
  shipment_number: string
  estimated_delivery: string
  status: string
}

export interface DashboardStats {
  totalDrivers: number
  activeDrivers: number
  totalTrucks: number
  activeTrucks: number
  totalRoutes: number
  activeRoutes: number
  totalLoads: number
  inTransitLoads: number
  totalMaintenance: number
  scheduledMaintenance: number
  fleetUtilization: number
  recentActivity: DashboardActivityItem[]
  recentDrivers: DashboardCardDriverRow[]
  recentTrucks: DashboardCardTruckRow[]
  recentRoutes: DashboardCardRouteRow[]
  recentLoads: DashboardCardLoadRow[]
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  outstandingInvoices: number
  revenueTrend: RevenueTrendPoint[]
  loadStatusDistribution: LoadStatusDistributionItem[]
  upcomingMaintenance: MaintenanceAlertRow[]
  overdueInvoices: OverdueInvoiceAlertRow[]
  upcomingDeliveries: UpcomingDeliveryRow[]
}
