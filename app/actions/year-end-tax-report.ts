"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"
import { htmlToPdfBuffer } from "@/lib/html-to-pdf-server"
import { escapeHtml } from "@/lib/html-escape"

/** Fiscal year tax report for accountants — aggregates existing accounting data. */

export type YearEndMonthRow = { month: string; monthIndex: number; revenue: number }

export type YearEndCustomerRow = { customer: string; revenue: number }

export type YearEndExpenseBreakdown = {
  fuel: number
  driverSettlements: number
  maintenance: number
  insurance: number
  tolls: number
  permitsAndLicenses: number
  otherOperating: number
  /** Sum of categorized lines (excludes settlements which are separate) */
  expensesSubtotal: number
  /** expensesSubtotal + driverSettlements */
  totalExpenses: number
}

export type YearEndIftaStateRow = {
  state: string
  miles: number
  fuelGallons: number
  taxDue: number
}

export type YearEndTruckRow = {
  truckId: string
  truckNumber: string
  revenue: number
  miles: number
  fuelCost: number
  maintenanceCost: number
  profit: number
}

export type YearEndTaxReportData = {
  year: number
  periodLabel: string
  company: {
    name: string
    ein: string | null
    addressLine: string
    mcNumber: string | null
    dotNumber: string | null
  }
  business: {
    totalTrucksOperated: number
    totalTrucksRegistered: number
    totalMiles: number
  }
  income: {
    grossRevenue: number
    revenueByMonth: YearEndMonthRow[]
    topCustomers: YearEndCustomerRow[]
  }
  expenses: YearEndExpenseBreakdown
  net: {
    grossRevenue: number
    totalExpenses: number
    netProfit: number
    profitMarginPct: number
  }
  ifta: {
    rows: YearEndIftaStateRow[]
    totalMiles: number
    totalFuelGallons: number
    totalTaxDue: number
    source: "ifta_reports" | "none"
  }
  perTruck: YearEndTruckRow[]
  generatedAt: string
}

function yearBounds(year: number) {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const endTs = `${year}-12-31T23:59:59.999Z`
  return { start, end, endTs }
}

function loadMiles(load: Record<string, unknown>): number {
  const em = Number(load.estimated_miles)
  if (Number.isFinite(em) && em > 0) return em
  const tp = load.trip_planning_estimate as Record<string, unknown> | null | undefined
  if (tp && typeof tp === "object") {
    const d = Number(tp.distance_miles)
    if (Number.isFinite(d) && d > 0) return d
  }
  return 0
}

function loadRevenue(load: Record<string, unknown>): number {
  return Number(load.total_rate) || Number(load.rate) || Number(load.value) || 0
}

function normalizeExpenseCategory(cat: string | null | undefined): string {
  const c = (cat || "other").toLowerCase()
  if (c.includes("fuel")) return "fuel"
  if (c.includes("insurance")) return "insurance"
  if (c.includes("toll")) return "tolls"
  if (c.includes("permit") || c.includes("license") || c.includes("licence")) return "permits"
  if (c.includes("maintenance") || c.includes("repair")) return "maintenance"
  return "other"
}

function parseIftaMiles(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const s = String(raw).replace(/,/g, "")
  const n = parseFloat(s.replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function parseIftaFuelGal(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const s = String(raw).replace(/,/g, "")
  const n = parseFloat(s.replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function mergeIftaStateBreakdown(reports: Array<{ state_breakdown?: unknown; total_miles?: unknown; fuel_purchased?: unknown; tax_owed?: unknown }>) {
  const byState = new Map<string, { miles: number; fuel: number; tax: number }>()
  let totalMiles = 0
  let totalFuel = 0
  let totalTax = 0

  for (const r of reports) {
    totalMiles += parseIftaMiles(r.total_miles as string)
    totalFuel += parseIftaFuelGal(r.fuel_purchased as string)
    totalTax += Number(r.tax_owed) || 0

    const rows = Array.isArray(r.state_breakdown) ? r.state_breakdown : []
    for (const row of rows as Array<Record<string, unknown>>) {
      const st = String(row.state || row.state_code || "??").toUpperCase().slice(0, 2)
      const miles = parseIftaMiles(row.miles as string)
      const fuel = parseIftaFuelGal((row.fuel as string) || (row.fuel_gallons as string))
      const tax =
        typeof row.tax === "number"
          ? row.tax
          : parseFloat(String(row.tax || "0").replace(/[^0-9.-]/g, "")) || 0
      const cur = byState.get(st) || { miles: 0, fuel: 0, tax: 0 }
      cur.miles += miles
      cur.fuel += fuel
      cur.tax += tax
      byState.set(st, cur)
    }
  }

  const sorted = Array.from(byState.entries())
    .map(([state, v]) => ({
      state,
      miles: v.miles,
      fuelGallons: v.fuel,
      taxDue: v.tax,
    }))
    .sort((a, b) => b.miles - a.miles)

  return { rows: sorted, totalMiles, totalFuel, totalTax }
}

/**
 * Aggregate all year-end tax data for the given calendar tax year.
 */
export async function generateYearEndTaxReport(year: number): Promise<{
  data: YearEndTaxReportData | null
  error: string | null
}> {
  try {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return { data: null, error: "Invalid tax year" }
    }

    const reportsOk = await checkViewPermission("reports")
    const accountingOk = await checkViewPermission("accounting")
    if (!reportsOk.allowed && !accountingOk.allowed) {
      return {
        data: null,
        error: reportsOk.error || accountingOk.error || "You don't have permission to view this report",
      }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { data: null, error: ctx.error || "Not authenticated" }
    }

    const companyId = ctx.companyId
    const supabase = await createClient()
    const { start, end, endTs } = yearBounds(year)

    const { data: company } = await supabase
      .from("companies")
      .select("name, address, city, state, zip, phone, email, mc_number, dot_number")
      .eq("id", companyId)
      .maybeSingle()

    const { data: settings } = await supabase
      .from("company_settings")
      .select("ein_number")
      .eq("company_id", companyId)
      .maybeSingle()

    const ein = (settings as { ein_number?: string | null } | null)?.ein_number || null
    const addressParts = [company?.address, [company?.city, company?.state].filter(Boolean).join(", "), company?.zip]
      .filter(Boolean)
      .join(" • ")

    const { data: trucks } = await supabase
      .from("trucks")
      .select("id, truck_number, status")
      .eq("company_id", companyId)

    const truckMap = new Map<string, string>()
    trucks?.forEach((t: { id: string; truck_number: string }) => truckMap.set(t.id, t.truck_number))

    const limit = 15000

    let invoiceQuery = supabase
      .from("invoices")
      .select("id, amount, customer_name, created_at, load_id")
      .eq("company_id", companyId)
      .gte("created_at", start)
      .lte("created_at", endTs)

    const { data: invoices } = await invoiceQuery.order("created_at", { ascending: true }).limit(limit)

    let loadQuery = supabase
      .from("loads")
      .select(
        "id, truck_id, customer_id, total_rate, rate, value, estimated_miles, trip_planning_estimate, created_at, load_date",
      )
      .eq("company_id", companyId)
      .gte("created_at", start)
      .lte("created_at", endTs)

    const { data: loads } = await loadQuery.limit(limit)

    const loadIdsWithInvoices = new Set<string>()
    invoices?.forEach((inv: { load_id?: string | null }) => {
      if (inv.load_id) loadIdsWithInvoices.add(inv.load_id)
    })

    /** Gross revenue — same logic as P&L: invoices + loads without invoice */
    let grossRevenue = 0
    invoices?.forEach((inv: { amount: unknown }) => {
      grossRevenue += Number(inv.amount) || 0
    })
    loads?.forEach((load: Record<string, unknown>) => {
      const id = load.id as string
      if (id && loadIdsWithInvoices.has(id)) return
      grossRevenue += loadRevenue(load)
    })

    /** Monthly revenue (invoices + orphan loads) */
    const monthBuckets = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      month: new Date(year, i, 1).toLocaleString("en-US", { month: "short" }),
      revenue: 0,
    }))

    const addToMonth = (iso: string | null | undefined, amt: number) => {
      if (!iso) return
      const d = new Date(iso)
      if (d.getFullYear() !== year) return
      const m = d.getMonth()
      monthBuckets[m].revenue += amt
    }

    invoices?.forEach((inv: { amount: unknown; created_at: string }) => {
      addToMonth(inv.created_at, Number(inv.amount) || 0)
    })
    loads?.forEach((load: Record<string, unknown>) => {
      const id = load.id as string
      if (id && loadIdsWithInvoices.has(id)) return
      const rev = loadRevenue(load)
      if (rev <= 0) return
      const dt = (load.load_date as string) || (load.created_at as string)
      addToMonth(dt, rev)
    })

    /** Top customers */
    const byCustomer: Record<string, number> = {}
    invoices?.forEach((inv: { customer_name?: string | null; amount: unknown }) => {
      const name = inv.customer_name?.trim() || "Unknown"
      byCustomer[name] = (byCustomer[name] || 0) + (Number(inv.amount) || 0)
    })
    loads?.forEach((load: Record<string, unknown>) => {
      const id = load.id as string
      if (id && loadIdsWithInvoices.has(id)) return
      const rev = loadRevenue(load)
      if (rev <= 0) return
      const name = "Load (no invoice)"
      byCustomer[name] = (byCustomer[name] || 0) + rev
    })

    const topCustomers: YearEndCustomerRow[] = Object.entries(byCustomer)
      .map(([customer, revenue]) => ({ customer, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    /** Expenses */
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, amount, category, date, truck_id")
      .eq("company_id", companyId)
      .gte("date", start)
      .lte("date", end)
      .limit(limit)

    let fuel = 0
    let insurance = 0
    let tolls = 0
    let permits = 0
    let maintenanceExp = 0
    let otherOperating = 0

    expenses?.forEach((e: { amount: unknown; category: string | null }) => {
      const amt = Number(e.amount) || 0
      const bucket = normalizeExpenseCategory(e.category)
      if (bucket === "fuel") fuel += amt
      else if (bucket === "insurance") insurance += amt
      else if (bucket === "tolls") tolls += amt
      else if (bucket === "permits") permits += amt
      else if (bucket === "maintenance") maintenanceExp += amt
      else otherOperating += amt
    })

    /** Maintenance table — filter in code (completed or scheduled in tax year) */
    const { data: maintRowsRaw } = await supabase
      .from("maintenance")
      .select("id, truck_id, actual_cost, estimated_cost, completed_date, scheduled_date, status")
      .eq("company_id", companyId)
      .limit(limit)

    const inTaxYear = (d: string | null) => {
      if (!d) return false
      const x = new Date(d)
      return x.getFullYear() === year
    }

    let maintenanceTable = 0
    const maintByTruck = new Map<string, number>()
    maintRowsRaw?.forEach((m: Record<string, unknown>) => {
      const completed = m.completed_date as string | null
      const sched = m.scheduled_date as string | null
      if (!inTaxYear(completed) && !(completed == null && inTaxYear(sched))) return
      const cost = Number(m.actual_cost) || Number(m.estimated_cost) || 0
      if (cost <= 0) return
      maintenanceTable += cost
      const tid = m.truck_id as string
      if (tid) maintByTruck.set(tid, (maintByTruck.get(tid) || 0) + cost)
    })

    const maintenance = maintenanceExp + maintenanceTable

    /** Settlements — paid, overlapping year */
    const { data: settlements } = await supabase
      .from("settlements")
      .select("id, net_pay, status, period_start, period_end")
      .eq("company_id", companyId)
      .eq("status", "paid")
      .lte("period_start", end)
      .gte("period_end", start)

    let driverSettlements = 0
    settlements?.forEach((s: { net_pay: unknown }) => {
      driverSettlements += Number(s.net_pay) || 0
    })

    const expensesSubtotal =
      fuel + insurance + tolls + permits + maintenance + otherOperating
    const totalExpenses = expensesSubtotal + driverSettlements

    const netProfit = grossRevenue - totalExpenses
    const profitMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

    /** Miles */
    let totalMilesLoads = 0
    loads?.forEach((load: Record<string, unknown>) => {
      totalMilesLoads += loadMiles(load)
    })

    /** Distinct trucks from loads in year */
    const truckIdsFromLoads = new Set<string>()
    loads?.forEach((load: Record<string, unknown>) => {
      const tid = load.truck_id as string | null
      if (tid) truckIdsFromLoads.add(tid)
    })

    /** IFTA — all quarterly reports for this year */
    const { data: iftaReports } = await supabase
      .from("ifta_reports")
      .select("state_breakdown, total_miles, fuel_purchased, tax_owed, year, quarter")
      .eq("company_id", companyId)
      .eq("year", year)

    const mergedIfta = mergeIftaStateBreakdown(
      (iftaReports || []) as Array<{
        state_breakdown?: unknown
        total_miles?: unknown
        fuel_purchased?: unknown
        tax_owed?: unknown
      }>,
    )
    const iftaSource: "ifta_reports" | "none" = iftaReports && iftaReports.length > 0 ? "ifta_reports" : "none"
    const totalMiles =
      mergedIfta.totalMiles > 0 ? mergedIfta.totalMiles : totalMilesLoads

    /** Fuel cost per truck from expenses */
    const fuelByTruck = new Map<string, number>()
    expenses?.forEach((e: { truck_id?: string | null; amount: unknown; category: string | null }) => {
      if (normalizeExpenseCategory(e.category) !== "fuel") return
      const tid = e.truck_id
      if (!tid) return
      fuelByTruck.set(tid, (fuelByTruck.get(tid) || 0) + (Number(e.amount) || 0))
    })

    /** Revenue & miles per truck */
    const perTruckAgg = new Map<string, { revenue: number; miles: number }>()
    loads?.forEach((load: Record<string, unknown>) => {
      const tid = load.truck_id as string | null
      if (!tid) return
      const id = load.id as string
      let rev = 0
      if (id && loadIdsWithInvoices.has(id)) {
        const inv = invoices?.find((i: { load_id?: string }) => i.load_id === id)
        rev = inv ? Number((inv as { amount: unknown }).amount) || 0 : 0
      } else {
        rev = loadRevenue(load)
      }
      const cur = perTruckAgg.get(tid) || { revenue: 0, miles: 0 }
      cur.revenue += rev
      cur.miles += loadMiles(load)
      perTruckAgg.set(tid, cur)
    })

    const perTruck: YearEndTruckRow[] = Array.from(perTruckAgg.entries()).map(([truckId, v]) => {
      const fuelCost = fuelByTruck.get(truckId) || 0
      const maintCost = maintByTruck.get(truckId) || 0
      const profit = v.revenue - fuelCost - maintCost
      return {
        truckId,
        truckNumber: truckMap.get(truckId) || truckId.slice(0, 8),
        revenue: v.revenue,
        miles: v.miles,
        fuelCost,
        maintenanceCost: maintCost,
        profit,
      }
    })
    perTruck.sort((a, b) => b.revenue - a.revenue)

    const data: YearEndTaxReportData = {
      year,
      periodLabel: `January 1 – December 31, ${year}`,
      company: {
        name: company?.name || "Company",
        ein,
        addressLine: addressParts || "",
        mcNumber: company?.mc_number ?? null,
        dotNumber: company?.dot_number ?? null,
      },
      business: {
        totalTrucksOperated: truckIdsFromLoads.size,
        totalTrucksRegistered: trucks?.length || 0,
        totalMiles,
      },
      income: {
        grossRevenue,
        revenueByMonth: monthBuckets.map((m) => ({
          month: m.month,
          monthIndex: m.monthIndex,
          revenue: m.revenue,
        })),
        topCustomers,
      },
      expenses: {
        fuel,
        driverSettlements,
        maintenance,
        insurance,
        tolls,
        permitsAndLicenses: permits,
        otherOperating,
        expensesSubtotal,
        totalExpenses,
      },
      net: {
        grossRevenue,
        totalExpenses,
        netProfit,
        profitMarginPct,
      },
      ifta: {
        rows: mergedIfta.rows,
        totalMiles: mergedIfta.totalMiles,
        totalFuelGallons: mergedIfta.totalFuel,
        totalTaxDue: mergedIfta.totalTax,
        source: iftaSource,
      },
      perTruck,
      generatedAt: new Date().toISOString(),
    }

    return { data, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to build year-end report"
    Sentry.captureException(e)
    return { data: null, error: msg }
  }
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

export async function getYearEndTaxReportHtml(year: number): Promise<{ html: string | null; error: string | null }> {
  const { data, error } = await generateYearEndTaxReport(year)
  if (error || !data) return { html: null, error: error || "No data" }
  return { html: buildYearEndTaxReportHtml(data), error: null }
}

function buildYearEndTaxReportHtml(d: YearEndTaxReportData): string {
  const rowsMonth = d.income.revenueByMonth
    .map(
      (r) => `
      <tr><td>${escapeHtml(r.month)}</td><td style="text-align:right">${formatMoney(r.revenue)}</td></tr>`,
    )
    .join("")

  const rowsCust = d.income.topCustomers
    .map(
      (r) => `
      <tr><td>${escapeHtml(r.customer)}</td><td style="text-align:right">${formatMoney(r.revenue)}</td></tr>`,
    )
    .join("")

  const rowsIfta = d.ifta.rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.state)}</td>
        <td style="text-align:right">${r.miles.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
        <td style="text-align:right">${r.fuelGallons.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td>
        <td style="text-align:right">${formatMoney(r.taxDue)}</td>
      </tr>`,
    )
    .join("")

  const rowsTruck = d.perTruck
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.truckNumber)}</td>
        <td style="text-align:right">${formatMoney(r.revenue)}</td>
        <td style="text-align:right">${r.miles.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
        <td style="text-align:right">${formatMoney(r.fuelCost)}</td>
        <td style="text-align:right">${formatMoney(r.maintenanceCost)}</td>
        <td style="text-align:right">${formatMoney(r.profit)}</td>
      </tr>`,
    )
    .join("")

  const iftaNote =
    d.ifta.source === "none"
      ? `<p class="note">No IFTA quarterly reports found for ${d.year}. Mile totals use load estimates where IFTA data is missing. Enter IFTA data under Tax &amp; Fuel for state-level fuel and tax.</p>`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Year-End Tax Report ${d.year} — ${escapeHtml(d.company.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 24px; background: #fff; }
    h1 { font-size: 20px; color: #1e3a8a; margin: 0 0 4px 0; }
    h2 { font-size: 14px; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin: 24px 0 10px 0; }
    .muted { color: #555; font-size: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
    th { background: #1e3a8a; color: #fff; text-align: left; }
    td.num { text-align: right; }
    .total { font-weight: bold; background: #eff6ff; }
    .note { font-size: 9px; color: #64748b; margin-top: 8px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <h1>TRUCKMATES YEAR-END TAX REPORT</h1>
  <p class="muted">${escapeHtml(d.company.name)} — FY ${d.year} &nbsp;|&nbsp; ${escapeHtml(d.periodLabel)}</p>
  <p class="muted">Generated ${escapeHtml(new Date(d.generatedAt).toLocaleString("en-US"))}</p>

  <h2>Section 1 — Business summary</h2>
  <div class="grid">
    <div class="box">
      <strong>${escapeHtml(d.company.name)}</strong><br/>
      ${d.company.ein ? `EIN: ${escapeHtml(d.company.ein)}<br/>` : ""}
      ${escapeHtml(d.company.addressLine)}<br/>
      ${d.company.mcNumber ? `MC# ${escapeHtml(d.company.mcNumber)} &nbsp; ` : ""}
      ${d.company.dotNumber ? `DOT# ${escapeHtml(d.company.dotNumber)}` : ""}
    </div>
    <div class="box">
      <div>Total trucks registered: <strong>${d.business.totalTrucksRegistered}</strong></div>
      <div>Trucks with loads in ${d.year}: <strong>${d.business.totalTrucksOperated}</strong></div>
      <div>Total miles (IFTA or load estimates): <strong>${Math.round(d.business.totalMiles).toLocaleString("en-US")}</strong></div>
    </div>
  </div>

  <h2>Section 2 — Income summary</h2>
  <p><strong>Gross revenue (invoices + loads without invoice):</strong> ${formatMoney(d.income.grossRevenue)}</p>
  <h3 style="font-size:12px;margin:12px 0 4px 0;">Revenue by month</h3>
  <table><thead><tr><th>Month</th><th class="num">Amount</th></tr></thead><tbody>${rowsMonth}</tbody></table>
  <h3 style="font-size:12px;margin:12px 0 4px 0;">Top customers by revenue</h3>
  <table><thead><tr><th>Customer</th><th class="num">Revenue</th></tr></thead><tbody>${rowsCust}</tbody></table>

  <h2>Section 3 — Expense summary</h2>
  <table>
    <tbody>
      <tr><td>Fuel (expenses)</td><td class="num">${formatMoney(d.expenses.fuel)}</td></tr>
      <tr><td>Driver settlements paid</td><td class="num">${formatMoney(d.expenses.driverSettlements)}</td></tr>
      <tr><td>Maintenance (expense category + service records)</td><td class="num">${formatMoney(d.expenses.maintenance)}</td></tr>
      <tr><td>Insurance</td><td class="num">${formatMoney(d.expenses.insurance)}</td></tr>
      <tr><td>Tolls</td><td class="num">${formatMoney(d.expenses.tolls)}</td></tr>
      <tr><td>Permits &amp; licenses</td><td class="num">${formatMoney(d.expenses.permitsAndLicenses)}</td></tr>
      <tr><td>Other operating expenses</td><td class="num">${formatMoney(d.expenses.otherOperating)}</td></tr>
      <tr class="total"><td>Total expenses (incl. driver pay)</td><td class="num">${formatMoney(d.expenses.totalExpenses)}</td></tr>
    </tbody>
  </table>

  <h2>Section 4 — Net profit / loss</h2>
  <table>
    <tbody>
      <tr><td>Gross revenue</td><td class="num">${formatMoney(d.net.grossRevenue)}</td></tr>
      <tr><td>Total expenses</td><td class="num">${formatMoney(d.net.totalExpenses)}</td></tr>
      <tr class="total"><td>Net profit (loss)</td><td class="num">${formatMoney(d.net.netProfit)}</td></tr>
      <tr><td>Profit margin</td><td class="num">${d.net.profitMarginPct.toFixed(1)}%</td></tr>
    </tbody>
  </table>

  <div class="page-break"></div>
  <h2>Section 5 — IFTA summary</h2>
  ${iftaNote}
  <table>
    <thead>
      <tr>
        <th>State</th>
        <th class="num">Miles</th>
        <th class="num">Fuel (gal)</th>
        <th class="num">Net tax due / (refund)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsIfta || `<tr><td colspan="4">No state breakdown available.</td></tr>`}
    </tbody>
  </table>
  <p class="muted">IFTA totals from quarterly reports: miles ${Math.round(d.ifta.totalMiles).toLocaleString("en-US")}, fuel ${d.ifta.totalFuelGallons.toFixed(1)} gal, tax ${formatMoney(d.ifta.totalTaxDue)}</p>

  <h2>Section 6 — Per-truck summary</h2>
  <table>
    <thead>
      <tr>
        <th>Truck</th>
        <th class="num">Revenue</th>
        <th class="num">Miles</th>
        <th class="num">Fuel cost</th>
        <th class="num">Maintenance</th>
        <th class="num">Profit (approx.)</th>
      </tr>
    </thead>
    <tbody>${rowsTruck || `<tr><td colspan="6">No truck-level loads in range.</td></tr>`}</tbody>
  </table>
  <p class="note">
    This document summarizes data recorded in TruckMates (invoices, expenses, settlements, maintenance, IFTA, loads).
    Per-truck profit excludes allocated driver settlements and shared overhead. Confirm figures with your tax professional before filing.
  </p>
</body>
</html>`
}

/**
 * Build PDF buffer for the year-end tax report (Letter, print background).
 */
export async function generateYearEndTaxReportPDF(year: number): Promise<{
  pdf: Buffer | null
  html: string | null
  error: string | null
}> {
  const { data, error } = await generateYearEndTaxReport(year)
  if (error || !data) {
    return { pdf: null, html: null, error: error || "No data" }
  }
  const html = buildYearEndTaxReportHtml(data)
  const { pdf, error: pdfErr } = await htmlToPdfBuffer(html)
  if (pdfErr) {
    return { pdf: null, html, error: pdfErr }
  }
  return { pdf, html: null, error: null }
}

/** For client download: PDF as base64 (or HTML fallback message in error). */
export async function generateYearEndTaxReportPdfBase64(year: number): Promise<{
  base64: string | null
  htmlFallback: string | null
  filename: string
  error: string | null
}> {
  const { pdf, html, error } = await generateYearEndTaxReportPDF(year)
  const filename = `year-end-tax-report-${year}.pdf`
  if (pdf) {
    return { base64: Buffer.from(pdf).toString("base64"), htmlFallback: null, filename, error: null }
  }
  if (html && !error) {
    return { base64: null, htmlFallback: html, filename, error: null }
  }
  return { base64: null, htmlFallback: html, filename, error: error || "PDF unavailable" }
}
