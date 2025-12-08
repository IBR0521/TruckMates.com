import { createClient } from "./server"
import { Database } from "./types"

type Tables = Database["public"]["Tables"]

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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getDriver(id: string) {
  const supabase = await createClient()
  return await supabase.from("drivers").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getTruck(id: string) {
  const supabase = await createClient()
  return await supabase.from("trucks").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getRoute(id: string) {
  const supabase = await createClient()
  return await supabase.from("routes").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getLoad(id: string) {
  const supabase = await createClient()
  return await supabase.from("loads").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getInvoice(id: string) {
  const supabase = await createClient()
  return await supabase.from("invoices").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("date", { ascending: false })
}

export async function getExpense(id: string) {
  const supabase = await createClient()
  return await supabase.from("expenses").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getSettlement(id: string) {
  const supabase = await createClient()
  return await supabase.from("settlements").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("scheduled_date", { ascending: false })
}

export async function getMaintenanceRecord(id: string) {
  const supabase = await createClient()
  return await supabase.from("maintenance").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
}

export async function getIFTAReport(id: string) {
  const supabase = await createClient()
  return await supabase.from("ifta_reports").select("*").eq("id", id).single()
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
    .select("*")
    .eq("company_id", companyId)
    .order("upload_date", { ascending: false })
}

export async function getDocument(id: string) {
  const supabase = await createClient()
  return await supabase.from("documents").select("*").eq("id", id).single()
}

export async function createDocument(data: Tables["documents"]["Insert"]) {
  const supabase = await createClient()
  return await supabase.from("documents").insert(data).select().single()
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()
  return await supabase.from("documents").delete().eq("id", id)
}

