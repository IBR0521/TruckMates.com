import { createClient } from "./server"
import { Database } from "./types"

type Tables = Database["public"]["Tables"]

// Explicit column lists to avoid `select("*")` over-fetching.
// Keep these in sync with `lib/supabase/types.ts` table `Row` definitions.
const DRIVERS_SELECT = "id, user_id, company_id, name, email, phone, license_number, license_expiry, status, truck_id, created_at, updated_at"
const TRUCKS_SELECT =
  "id, company_id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, current_location, fuel_level, mileage, created_at, updated_at"
const ROUTES_SELECT =
  "id, company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, waypoints, estimated_arrival, created_at, updated_at"
const LOADS_SELECT =
  "id, company_id, shipment_number, origin, destination, weight, weight_kg, contents, value, carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery, actual_delivery, coordinates, created_at, updated_at"
const INVOICES_SELECT =
  "id, company_id, invoice_number, customer_name, load_id, amount, status, issue_date, due_date, payment_terms, description, items, created_at, updated_at"
const EXPENSES_SELECT =
  "id, company_id, category, description, amount, date, vendor, driver_id, truck_id, mileage, payment_method, receipt_url, has_receipt, created_at, updated_at"
const SETTLEMENTS_SELECT =
  "id, company_id, driver_id, period_start, period_end, gross_pay, fuel_deduction, advance_deduction, other_deductions, total_deductions, net_pay, status, paid_date, payment_method, loads, created_at, updated_at"
const MAINTENANCE_SELECT =
  "id, company_id, truck_id, service_type, scheduled_date, completed_date, mileage, status, priority, estimated_cost, actual_cost, vendor, technician, notes, next_service_due_mileage, created_at, updated_at"
const IFta_REPORTS_SELECT =
  "id, company_id, quarter, year, period, total_miles, fuel_purchased, tax_owed, status, filed_date, state_breakdown, truck_ids, include_eld, created_at, updated_at"
const DOCUMENTS_SELECT =
  "id, company_id, name, type, file_url, file_size, upload_date, expiry_date, truck_id, driver_id, created_at, updated_at"

// Helper function to get user's company_id
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single()

  if (error || !data) return null
  return data.company_id
}

// Drivers queries
export async function getDrivers(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("drivers")
    .select(DRIVERS_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getDriver(id: string) {
  const supabase = await createClient()
  return await supabase.from("drivers").select(DRIVERS_SELECT).eq("id", id).single()
}

export async function createDriver(data: Tables["drivers"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("drivers").insert(data).select().single()
}

export async function updateDriver(id: string, data: Tables["drivers"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("drivers").update(data).eq("id", id).select().single()
}

export async function deleteDriver(id: string) {
  const supabase = await createClient()
  return await supabase.from("drivers").delete().eq("id", id)
}

// Trucks queries
export async function getTrucks(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("trucks")
    .select(TRUCKS_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getTruck(id: string) {
  const supabase = await createClient()
  return await supabase.from("trucks").select(TRUCKS_SELECT).eq("id", id).single()
}

export async function createTruck(data: Tables["trucks"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("trucks").insert(data).select().single()
}

export async function updateTruck(id: string, data: Tables["trucks"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("trucks").update(data).eq("id", id).select().single()
}

export async function deleteTruck(id: string) {
  const supabase = await createClient()
  return await supabase.from("trucks").delete().eq("id", id)
}

// Routes queries
export async function getRoutes(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("routes")
    .select(ROUTES_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getRoute(id: string) {
  const supabase = await createClient()
  return await supabase.from("routes").select(ROUTES_SELECT).eq("id", id).single()
}

export async function createRoute(data: Tables["routes"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("routes").insert(data).select().single()
}

export async function updateRoute(id: string, data: Tables["routes"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("routes").update(data).eq("id", id).select().single()
}

export async function deleteRoute(id: string) {
  const supabase = await createClient()
  return await supabase.from("routes").delete().eq("id", id)
}

// Loads queries
export async function getLoads(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("loads")
    .select(LOADS_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getLoad(id: string) {
  const supabase = await createClient()
  return await supabase.from("loads").select(LOADS_SELECT).eq("id", id).single()
}

export async function createLoad(data: Tables["loads"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("loads").insert(data).select().single()
}

export async function updateLoad(id: string, data: Tables["loads"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("loads").update(data).eq("id", id).select().single()
}

export async function deleteLoad(id: string) {
  const supabase = await createClient()
  return await supabase.from("loads").delete().eq("id", id)
}

// Invoices queries
export async function getInvoices(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("invoices")
    .select(INVOICES_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getInvoice(id: string) {
  const supabase = await createClient()
  return await supabase.from("invoices").select(INVOICES_SELECT).eq("id", id).single()
}

export async function createInvoice(data: Tables["invoices"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("invoices").insert(data).select().single()
}

export async function updateInvoice(id: string, data: Tables["invoices"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("invoices").update(data).eq("id", id).select().single()
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()
  return await supabase.from("invoices").delete().eq("id", id)
}

// Expenses queries
export async function getExpenses(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("expenses")
    .select(EXPENSES_SELECT)
    .eq("company_id", companyId)
    .order("date", { ascending: false })
}

export async function getExpense(id: string) {
  const supabase = await createClient()
  return await supabase.from("expenses").select(EXPENSES_SELECT).eq("id", id).single()
}

export async function createExpense(data: Tables["expenses"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("expenses").insert(data).select().single()
}

export async function updateExpense(id: string, data: Tables["expenses"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("expenses").update(data).eq("id", id).select().single()
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  return await supabase.from("expenses").delete().eq("id", id)
}

// Settlements queries
export async function getSettlements(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("settlements")
    .select(SETTLEMENTS_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getSettlement(id: string) {
  const supabase = await createClient()
  return await supabase.from("settlements").select(SETTLEMENTS_SELECT).eq("id", id).single()
}

export async function createSettlement(data: Tables["settlements"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("settlements").insert(data).select().single()
}

export async function updateSettlement(id: string, data: Tables["settlements"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("settlements").update(data).eq("id", id).select().single()
}

// Maintenance queries
export async function getMaintenance(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("maintenance")
    .select(MAINTENANCE_SELECT)
    .eq("company_id", companyId)
    .order("scheduled_date", { ascending: false })
}

export async function getMaintenanceRecord(id: string) {
  const supabase = await createClient()
  return await supabase.from("maintenance").select(MAINTENANCE_SELECT).eq("id", id).single()
}

export async function createMaintenance(data: Tables["maintenance"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("maintenance").insert(data).select().single()
}

export async function updateMaintenance(id: string, data: Tables["maintenance"]["Update"]) {
  const supabase = await createClient()
  return await supabase.from("maintenance").update(data).eq("id", id).select().single()
}

export async function deleteMaintenance(id: string) {
  const supabase = await createClient()
  return await supabase.from("maintenance").delete().eq("id", id)
}

// IFTA Reports queries
export async function getIFTAReports(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("ifta_reports")
    .select(IFta_REPORTS_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getIFTAReport(id: string) {
  const supabase = await createClient()
  return await supabase.from("ifta_reports").select(IFta_REPORTS_SELECT).eq("id", id).single()
}

export async function createIFTAReport(data: Tables["ifta_reports"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("ifta_reports").insert(data).select().single()
}

// Documents queries
export async function getDocuments(companyId: string) {
  const supabase = await createClient()
  return await supabase
    .from("documents")
    .select(DOCUMENTS_SELECT)
    .eq("company_id", companyId)
    .order("upload_date", { ascending: false })
}

export async function getDocument(id: string) {
  const supabase = await createClient()
  return await supabase.from("documents").select(DOCUMENTS_SELECT).eq("id", id).single()
}

export async function createDocument(data: Tables["documents"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("documents").insert(data).select().single()
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()
  return await supabase.from("documents").delete().eq("id", id)
}

