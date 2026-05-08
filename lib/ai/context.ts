import { createAdminClient } from "@/lib/supabase/admin"
import { computeDailyRemainingFromEldLogs, type EldLogLike } from "@/lib/hos/compute-daily-remaining"

type Row = Record<string, unknown>

function toIsoDate(value: unknown): string | null {
  if (!value) return null
  const text = String(value)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatHours(value: number): string {
  return `${Math.max(0, value).toFixed(2)}h`
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function statusBreakdown(rows: Row[], key = "status"): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const status = String(row[key] || "unknown").toLowerCase()
    counts[status] = (counts[status] || 0) + 1
  }
  return counts
}

function renderBreakdown(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return "none"
  return entries.map(([key, value]) => `${key}:${value}`).join(", ")
}

function safeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function parseEndorsements(value: unknown): string {
  const text = String(value || "").trim()
  return text || "unknown"
}

export async function getFleetContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const [trucksResult, trailersResult, maintenanceResult] = await Promise.all([
      supabase.from("trucks").select("id, status").eq("company_id", companyId),
      supabase.from("trailers").select("id, status").eq("company_id", companyId),
      supabase.from("maintenance").select("truck_id, status").eq("company_id", companyId),
    ])

    if (trucksResult.error || trailersResult.error || maintenanceResult.error) return ""

    const trucks = (trucksResult.data || []) as Row[]
    const trailers = (trailersResult.data || []) as Row[]
    const maintenance = (maintenanceResult.data || []) as Row[]
    const maintenanceTruckIds = new Set(
      maintenance
        .filter((row) => ["open", "pending", "scheduled", "in_progress"].includes(String(row.status || "").toLowerCase()))
        .map((row) => String(row.truck_id || ""))
        .filter(Boolean)
    )

    const activeTrucks = trucks.filter((row) => !["inactive", "retired"].includes(String(row.status || "").toLowerCase())).length
    const availableTrucks = trucks.filter((row) => ["available", "idle", "active"].includes(String(row.status || "").toLowerCase())).length
    const trucksInMaintenance =
      trucks.filter((row) => ["maintenance", "in_shop", "out_of_service"].includes(String(row.status || "").toLowerCase())).length +
      maintenanceTruckIds.size

    const trailerBreakdown = statusBreakdown(trailers)

    return [
      "Fleet Context:",
      `- Active trucks: ${activeTrucks}`,
      `- Available trucks: ${availableTrucks}`,
      `- Trucks in maintenance: ${trucksInMaintenance}`,
      `- Trailers total: ${trailers.length}`,
      `- Trailer status breakdown: ${renderBreakdown(trailerBreakdown)}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getDriverContext(companyId: string, driverId?: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    if (driverId) {
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", driverId)
        .maybeSingle()

      if (driverError || !driver) return ""

      const normalizedDriverId = String(driver.id)
      const linkedUserId = String((driver as Row).user_id || "").trim()
      const logIds = linkedUserId ? [normalizedDriverId, linkedUserId] : [normalizedDriverId]
      const eightDaysAgo = addDays(startOfUtcDay(), -8).toISOString()
      const todayYmd = new Date().toISOString().slice(0, 10)

      const [logsResult, latestLogResult, eventsResult, truckResult] = await Promise.all([
        supabase
          .from("eld_logs")
          .select("driver_id, log_type, duration_minutes, start_time, end_time, log_date")
          .in("driver_id", logIds)
          .gte("start_time", eightDaysAgo)
          .order("start_time", { ascending: false })
          .limit(2000),
        supabase
          .from("eld_logs")
          .select("log_type, start_time")
          .in("driver_id", logIds)
          .order("start_time", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("eld_events")
          .select("id")
          .eq("company_id", companyId)
          .eq("event_type", "hos_violation")
          .eq("resolved", false)
          .gte("event_time", addDays(startOfUtcDay(), -90).toISOString())
          .or(`driver_id.eq.${normalizedDriverId},driver_id.eq.${linkedUserId || "__none__"}`),
        (driver as Row).truck_id
          ? supabase
              .from("trucks")
              .select("current_location")
              .eq("company_id", companyId)
              .eq("id", String((driver as Row).truck_id))
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (logsResult.error || latestLogResult.error || eventsResult.error) return ""

      const logs = (logsResult.data || []) as EldLogLike[]
      const todayLogs = logs.filter((log) => {
        const logDate = String((log as Row).log_date || "")
        if (logDate === todayYmd) return true
        const start = String((log as Row).start_time || "")
        return start.slice(0, 10) === todayYmd
      })
      const hos = computeDailyRemainingFromEldLogs(todayLogs, Date.now(), logs)
      const location =
        String((driver as Row).current_location || "").trim() ||
        String(((truckResult as { data?: Row | null })?.data as Row | null)?.current_location || "").trim() ||
        "unknown"

      return [
        "Driver Context:",
        `- Name: ${String((driver as Row).name || "unknown")}`,
        `- CDL class: ${String((driver as Row).license_type || "unknown")}`,
        `- Endorsements: ${parseEndorsements((driver as Row).license_endorsements)}`,
        `- Remaining HOS drive hours: ${formatHours(hos.remainingDriving)}`,
        `- Remaining HOS on-duty hours: ${formatHours(hos.remainingOnDuty)}`,
        `- Current duty status: ${String(((latestLogResult.data as Row | null)?.log_type as string) || "off_duty")}`,
        `- Current location (last known): ${location}`,
        `- Violations in last 90 days: ${(eventsResult.data || []).length}`,
      ].join("\n")
    }

    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, status")
      .eq("company_id", companyId)

    if (driversError) return ""

    const driverRows = (drivers || []) as Row[]
    const driverIds = driverRows.map((row) => String(row.id)).filter(Boolean)
    const todayStart = startOfUtcDay().toISOString()

    const [latestLogsResult, violationsTodayResult] = await Promise.all([
      driverIds.length > 0
        ? supabase
            .from("eld_logs")
            .select("driver_id, log_type, start_time")
            .in("driver_id", driverIds)
            .gte("start_time", addDays(startOfUtcDay(), -1).toISOString())
            .order("start_time", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("eld_events")
        .select("id")
        .eq("company_id", companyId)
        .eq("event_type", "hos_violation")
        .gte("event_time", todayStart),
    ])

    if (latestLogsResult.error || violationsTodayResult.error) return ""

    const latestByDriver = new Map<string, string>()
    for (const log of (latestLogsResult.data || []) as Row[]) {
      const id = String(log.driver_id || "")
      if (!id || latestByDriver.has(id)) continue
      latestByDriver.set(id, String(log.log_type || "off_duty"))
    }

    let onDuty = 0
    for (const status of latestByDriver.values()) {
      if (status === "driving" || status === "on_duty") onDuty += 1
    }
    const available = Math.max(0, driverRows.length - onDuty)

    return [
      "Driver Context:",
      `- Total drivers: ${driverRows.length}`,
      `- On-duty drivers: ${onDuty}`,
      `- Available drivers: ${available}`,
      `- Drivers with HOS violations today: ${(violationsTodayResult.data || []).length}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getLoadContext(companyId: string, loadId?: string): Promise<string> {
  try {
    const supabase = createAdminClient()

    if (loadId) {
      const { data: load, error: loadError } = await supabase
        .from("loads")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", loadId)
        .maybeSingle()

      if (loadError || !load) return ""

      const loadRow = load as Row

      const [driverResult, truckResult, customerResult] = await Promise.all([
        loadRow.driver_id
          ? supabase.from("drivers").select("name").eq("company_id", companyId).eq("id", String(loadRow.driver_id)).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        loadRow.truck_id
          ? supabase.from("trucks").select("truck_number").eq("company_id", companyId).eq("id", String(loadRow.truck_id)).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        loadRow.customer_id
          ? supabase.from("customers").select("name").eq("company_id", companyId).eq("id", String(loadRow.customer_id)).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const eta =
        String(loadRow.current_eta || "").trim() ||
        String(loadRow.eta || "").trim() ||
        String(loadRow.estimated_delivery || "").trim() ||
        "unknown"

      const detention = safeNumber(loadRow.detention_amount || loadRow.detention_total || 0)
      const accessorials = safeNumber(loadRow.accessorial_total || loadRow.accessorial_amount || 0)
      const rate = safeNumber(loadRow.rate ?? loadRow.value ?? 0)

      return [
        "Load Context:",
        `- Origin: ${String(loadRow.origin || "unknown")}`,
        `- Destination: ${String(loadRow.destination || "unknown")}`,
        `- Customer: ${String((customerResult.data as Row | null)?.name || loadRow.customer_name || "unknown")}`,
        `- Rate: ${formatMoney(rate)}`,
        `- Status: ${String(loadRow.status || "unknown")}`,
        `- Assigned driver: ${String((driverResult.data as Row | null)?.name || "unassigned")}`,
        `- Assigned truck: ${String((truckResult.data as Row | null)?.truck_number || "unassigned")}`,
        `- Pickup time: ${String(loadRow.pickup_time || loadRow.load_date || "unknown")}`,
        `- Delivery time: ${String(loadRow.delivery_time || loadRow.estimated_delivery || "unknown")}`,
        `- Current ETA: ${eta}`,
        `- Detention: ${formatMoney(detention)}`,
        `- Accessorials: ${formatMoney(accessorials)}`,
      ].join("\n")
    }

    const { data: loads, error: loadsError } = await supabase
      .from("loads")
      .select("id, status, estimated_delivery, delivery_time")
      .eq("company_id", companyId)

    if (loadsError) return ""

    const now = new Date()
    const todayYmd = now.toISOString().slice(0, 10)
    const deliveredStatuses = new Set(["delivered", "invoiced", "paid", "cancelled"])
    const rows = (loads || []) as Row[]
    const byStatus = statusBreakdown(rows)

    let dueToday = 0
    let overdue = 0

    for (const load of rows) {
      const eta = String(load.delivery_time || load.estimated_delivery || "")
      if (!eta) continue
      const etaDate = toIsoDate(eta)
      if (!etaDate) continue
      const etaYmd = etaDate.slice(0, 10)
      const status = String(load.status || "").toLowerCase()
      if (etaYmd === todayYmd) dueToday += 1
      if (etaDate < now.toISOString() && !deliveredStatuses.has(status)) overdue += 1
    }

    return [
      "Load Context:",
      `- Load status breakdown: ${renderBreakdown(byStatus)}`,
      `- Loads due today: ${dueToday}`,
      `- Overdue loads: ${overdue}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getFinancialContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("amount, status, due_date, issue_date, customer_name")
        .eq("company_id", companyId),
      supabase
        .from("expenses")
        .select("amount, date")
        .eq("company_id", companyId),
    ])

    if (invoicesResult.error || expensesResult.error) return ""

    const invoices = (invoicesResult.data || []) as Row[]
    const expenses = (expensesResult.data || []) as Row[]

    const paidStatuses = new Set(["paid"])
    const openStatuses = new Set(["pending", "sent", "overdue", "invoiced", "approved"])
    const now = new Date()
    const todayIso = now.toISOString()
    const monthStart = startOfUtcMonth(now)
    const previousMonthStart = startOfUtcMonth(addDays(monthStart, -1))

    let arOutstanding = 0
    const agingBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }
    const overdueByCustomer = new Map<string, number>()
    let revenueThisMonth = 0
    let revenueLastMonth = 0

    for (const invoice of invoices) {
      const amount = safeNumber(invoice.amount)
      const status = String(invoice.status || "").toLowerCase()
      const issueDate = toIsoDate(invoice.issue_date)
      const dueDate = toIsoDate(invoice.due_date)
      const customer = String(invoice.customer_name || "unknown")

      if (!paidStatuses.has(status) && openStatuses.has(status)) {
        arOutstanding += amount
      }

      if (!paidStatuses.has(status) && dueDate) {
        const daysPastDue = Math.floor((new Date(todayIso).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
        if (daysPastDue <= 30) agingBuckets["0-30"] += amount
        else if (daysPastDue <= 60) agingBuckets["31-60"] += amount
        else if (daysPastDue <= 90) agingBuckets["61-90"] += amount
        else agingBuckets["90+"] += amount

        if (daysPastDue > 0) {
          overdueByCustomer.set(customer, (overdueByCustomer.get(customer) || 0) + amount)
        }
      }

      if (issueDate) {
        const issue = new Date(issueDate)
        if (issue >= monthStart) revenueThisMonth += amount
        else if (issue >= previousMonthStart && issue < monthStart) revenueLastMonth += amount
      }
    }

    let currentMonthExpenseTotal = 0
    for (const expense of expenses) {
      const dateIso = toIsoDate(expense.date)
      if (!dateIso) continue
      if (new Date(dateIso) >= monthStart) {
        currentMonthExpenseTotal += safeNumber(expense.amount)
      }
    }

    const topOverdue = [...overdueByCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, amount]) => `${name}:${formatMoney(amount)}`)
      .join(", ") || "none"

    return [
      "Financial Context:",
      `- Total AR outstanding: ${formatMoney(arOutstanding)}`,
      `- AR aging 0-30: ${formatMoney(agingBuckets["0-30"])}`,
      `- AR aging 31-60: ${formatMoney(agingBuckets["31-60"])}`,
      `- AR aging 61-90: ${formatMoney(agingBuckets["61-90"])}`,
      `- AR aging 90+: ${formatMoney(agingBuckets["90+"])}`,
      `- Revenue this month: ${formatMoney(revenueThisMonth)}`,
      `- Revenue last month: ${formatMoney(revenueLastMonth)}`,
      `- Top 3 overdue customers: ${topOverdue}`,
      `- Current month expense total: ${formatMoney(currentMonthExpenseTotal)}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getComplianceContext(companyId: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const today = startOfUtcDay()
    const in30Days = addDays(today, 30)

    const [documentsResult, driversResult, csaResult, registrationsResult] = await Promise.all([
      supabase
        .from("documents")
        .select("type, expiry_date, truck_id")
        .eq("company_id", companyId)
        .not("expiry_date", "is", null),
      supabase
        .from("drivers")
        .select("name, license_expiry")
        .eq("company_id", companyId),
      supabase
        .from("csa_scores")
        .select("snapshot_month, unsafe_driving, hours_of_service, driver_fitness, controlled_substances, vehicle_maintenance, hazardous_materials, crash_indicator")
        .eq("company_id", companyId)
        .order("snapshot_month", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("compliance_registrations")
        .select("type, expiry_date, status")
        .eq("company_id", companyId)
        .in("type", ["ucr", "irp", "mcs150"]),
    ])

    if (documentsResult.error || driversResult.error || registrationsResult.error) return ""

    const documents = (documentsResult.data || []) as Row[]
    const drivers = (driversResult.data || []) as Row[]
    const registrations = (registrationsResult.data || []) as Row[]

    const expiringDocCounts: Record<string, number> = {}
    const overdueInspectionTruckIds = new Set<string>()
    for (const doc of documents) {
      const type = String(doc.type || "unknown").toLowerCase()
      const expiryIso = toIsoDate(doc.expiry_date)
      if (!expiryIso) continue

      const expiry = new Date(expiryIso)
      if (expiry >= today && expiry <= in30Days) {
        expiringDocCounts[type] = (expiringDocCounts[type] || 0) + 1
      }

      if (type.includes("inspection") && expiry < today && doc.truck_id) {
        overdueInspectionTruckIds.add(String(doc.truck_id))
      }
    }

    let driversWithComplianceIssues = 0
    for (const driver of drivers) {
      const expiryIso = toIsoDate(driver.license_expiry)
      if (!expiryIso) continue
      const expiry = new Date(expiryIso)
      if (expiry <= in30Days) driversWithComplianceIssues += 1
    }

    const latestCsa = (csaResult.data || null) as Row | null
    const latestMonth = String(latestCsa?.snapshot_month || "not_available")
    const csaKeys = [
      "unsafe_driving",
      "hours_of_service",
      "driver_fitness",
      "controlled_substances",
      "vehicle_maintenance",
      "hazardous_materials",
      "crash_indicator",
    ]
    const above55 = csaKeys
      .map((key) => ({ key, value: safeNumber(latestCsa?.[key]) }))
      .filter((entry) => entry.value > 55)
      .map((entry) => `${entry.key}:${entry.value.toFixed(1)}%`)
      .join(", ") || "none"

    const upcomingRenewals = registrations
      .filter((reg) => {
        const expiryIso = toIsoDate(reg.expiry_date)
        if (!expiryIso) return false
        const expiry = new Date(expiryIso)
        const status = String(reg.status || "active").toLowerCase()
        return status !== "inactive" && expiry >= today && expiry <= in30Days
      })
      .map((reg) => String(reg.type || "unknown"))
      .reduce<Record<string, number>>((acc, type) => {
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

    return [
      "Compliance Context:",
      `- Documents expiring in next 30 days: ${renderBreakdown(expiringDocCounts)}`,
      `- Drivers with compliance issues: ${driversWithComplianceIssues}`,
      `- Trucks with overdue inspections: ${overdueInspectionTruckIds.size}`,
      `- CSA latest month: ${latestMonth}`,
      `- CSA categories above 55%: ${above55}`,
      `- Upcoming registration renewals (UCR/IRP/MCS-150): ${renderBreakdown(upcomingRenewals)}`,
    ].join("\n")
  } catch {
    return ""
  }
}

export async function getMaintenanceContext(companyId: string, truckId?: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const today = startOfUtcDay()

    if (truckId) {
      const [truckResult, maintenanceResult, workOrdersResult, dvirResult] = await Promise.all([
        supabase
          .from("trucks")
          .select("truck_number, mileage")
          .eq("company_id", companyId)
          .eq("id", truckId)
          .maybeSingle(),
        supabase
          .from("maintenance")
          .select("service_type, scheduled_date, completed_date, status, mileage")
          .eq("company_id", companyId)
          .eq("truck_id", truckId)
          .order("scheduled_date", { ascending: false })
          .limit(50),
        supabase
          .from("work_orders")
          .select("id, status")
          .eq("company_id", companyId)
          .eq("truck_id", truckId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("dvir")
          .select("inspection_date, has_defects, defects")
          .eq("company_id", companyId)
          .eq("truck_id", truckId)
          .order("inspection_date", { ascending: false })
          .limit(20),
      ])

      if (maintenanceResult.error || workOrdersResult.error || dvirResult.error) return ""

      const maintenanceRows = (maintenanceResult.data || []) as Row[]
      const workOrders = (workOrdersResult.data || []) as Row[]
      const dvirRows = (dvirResult.data || []) as Row[]

      const lastService = maintenanceRows.find((row) => String(row.completed_date || "").trim()) || maintenanceRows[0]
      const upcomingServices = maintenanceRows.filter((row) => {
        const scheduledIso = toIsoDate(row.scheduled_date)
        if (!scheduledIso) return false
        const status = String(row.status || "").toLowerCase()
        return new Date(scheduledIso) >= today && !["completed", "cancelled"].includes(status)
      })
      const openWorkOrders = workOrders.filter((row) => !["completed", "cancelled", "closed"].includes(String(row.status || "").toLowerCase()))
      const recentDefects = dvirRows.filter((row) => Boolean(row.has_defects)).length

      return [
        "Maintenance Context:",
        `- Truck: ${String((truckResult.data as Row | null)?.truck_number || truckId)}`,
        `- Last service date: ${String((lastService as Row | undefined)?.completed_date || (lastService as Row | undefined)?.scheduled_date || "unknown")}`,
        `- Mileage: ${String((truckResult.data as Row | null)?.mileage ?? (lastService as Row | undefined)?.mileage ?? "unknown")}`,
        `- Upcoming scheduled services: ${upcomingServices.length}`,
        `- Open work orders: ${openWorkOrders.length}`,
        `- Recent DVIR defects: ${recentDefects}`,
      ].join("\n")
    }

    const [maintenanceResult, workOrdersResult, trucksResult] = await Promise.all([
      supabase
        .from("maintenance")
        .select("truck_id, status, scheduled_date")
        .eq("company_id", companyId),
      supabase
        .from("work_orders")
        .select("truck_id, status")
        .eq("company_id", companyId),
      supabase
        .from("trucks")
        .select("id, status")
        .eq("company_id", companyId),
    ])

    if (maintenanceResult.error || workOrdersResult.error || trucksResult.error) return ""

    const maintenanceRows = (maintenanceResult.data || []) as Row[]
    const workOrders = (workOrdersResult.data || []) as Row[]
    const trucks = (trucksResult.data || []) as Row[]
    const weekEnd = addDays(today, 7)

    let overdueCount = 0
    let dueThisWeekCount = 0

    for (const row of maintenanceRows) {
      const scheduledIso = toIsoDate(row.scheduled_date)
      if (!scheduledIso) continue
      const status = String(row.status || "").toLowerCase()
      if (["completed", "cancelled"].includes(status)) continue
      const scheduled = new Date(scheduledIso)
      if (scheduled < today) overdueCount += 1
      if (scheduled >= today && scheduled <= weekEnd) dueThisWeekCount += 1
    }

    const trucksInShop = trucks.filter((row) =>
      ["maintenance", "in_shop", "repair", "out_of_service"].includes(String(row.status || "").toLowerCase())
    ).length
    const openWorkOrders = workOrders.filter((row) =>
      !["completed", "cancelled", "closed"].includes(String(row.status || "").toLowerCase())
    ).length

    return [
      "Maintenance Context:",
      `- Fleet overdue maintenance count: ${overdueCount}`,
      `- Maintenance due this week: ${dueThisWeekCount}`,
      `- Trucks currently in shop: ${trucksInShop}`,
      `- Open work orders: ${openWorkOrders}`,
    ].join("\n")
  } catch {
    return ""
  }
}
