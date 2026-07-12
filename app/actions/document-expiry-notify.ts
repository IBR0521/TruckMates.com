// NOT a "use server" module (F9): these are cron workers that take a companyId and run on the
// service-role admin client. As server actions, any authenticated user could invoke them for an
// arbitrary company (cross-tenant side effects). Imported only by cron routes / the agent executor.

import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotification } from "@/app/actions/notifications"
import { batchOperations } from "@/lib/performance"
import {
  COMPLIANCE_NOTIFICATION_SETTINGS_SELECT,
  isComplianceNotifyEventEnabled,
  parseComplianceExpiryLeadDays,
  type ComplianceNotificationSettings,
} from "@/lib/compliance-notify-settings"

const MANAGER_ROLES = new Set(["super_admin", "operations_manager", "safety_compliance"])
const DEDUPE_HOURS = 24

type ExpiringItem = {
  id: string
  type: string
  label: string
  expiryDate: string
  daysUntil: number
}

async function getManagerUserIds(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .in("role", ["super_admin", "operations_manager", "safety_compliance", "dispatcher"])
  return (data || [])
    .filter((u: { role?: string | null }) => MANAGER_ROLES.has(String(u.role || "")) || u.role === "dispatcher")
    .map((u: { id: string }) => u.id)
}

async function wasRecentlyNotified(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  itemId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", since)
    .filter("metadata->>event", "eq", "document_expiry")
    .filter("metadata->>item_id", "eq", itemId)
  return (count ?? 0) > 0
}

async function collectExpiringItems(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  leadDays: number[],
): Promise<ExpiringItem[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxLead = Math.max(...leadDays, 30)
  const future = new Date(today)
  future.setDate(future.getDate() + maxLead)
  const todayIso = today.toISOString().split("T")[0]
  const futureIso = future.toISOString().split("T")[0]

  const items: ExpiringItem[] = []

  const pushIfLead = (id: string, type: string, label: string, expiry: string | null) => {
    if (!expiry) return
    const exp = new Date(expiry)
    if (Number.isNaN(exp.getTime())) return
    exp.setHours(0, 0, 0, 0)
    const daysUntil = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (leadDays.includes(daysUntil) || daysUntil < 0) {
      items.push({ id: `${type}:${id}`, type, label, expiryDate: expiry, daysUntil })
    }
  }

  const { data: docs } = await admin
    .from("documents")
    .select("id, name, expiry_date")
    .eq("company_id", companyId)
    .not("expiry_date", "is", null)
    .gte("expiry_date", todayIso)
    .lte("expiry_date", futureIso)
    .limit(500)
  for (const d of docs || []) {
    pushIfLead(String(d.id), "document", String(d.name || d.id), d.expiry_date as string)
  }

  const { data: drivers } = await admin
    .from("drivers")
    .select("id, name, license_expiry")
    .eq("company_id", companyId)
    .not("license_expiry", "is", null)
    .gte("license_expiry", todayIso)
    .lte("license_expiry", futureIso)
    .limit(500)
  for (const d of drivers || []) {
    pushIfLead(String(d.id), "license", String(d.name || d.id), d.license_expiry as string)
  }

  const { data: trucks } = await admin
    .from("trucks")
    .select("id, truck_number, license_expiry_date, insurance_expiry_date")
    .eq("company_id", companyId)
    .limit(500)
  for (const t of trucks || []) {
    pushIfLead(String(t.id), "truck_license", `Truck ${t.truck_number}`, t.license_expiry_date as string)
    pushIfLead(String(t.id), "truck_insurance", `Truck ${t.truck_number} insurance`, t.insurance_expiry_date as string)
  }

  return items
}

export async function scanDocumentExpiryForCompany(companyId: string): Promise<{
  data: { notified: number; scanned: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from("company_settings")
    .select(COMPLIANCE_NOTIFICATION_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()

  const notifySettings = (settings as ComplianceNotificationSettings | null) ?? null
  if (!isComplianceNotifyEventEnabled(notifySettings, "document_expiry")) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const leadDays = parseComplianceExpiryLeadDays(notifySettings?.compliance_expiry_lead_days)
  const items = await collectExpiringItems(admin, companyId, leadDays)
  if (items.length === 0) return { data: { notified: 0, scanned: 0 }, error: null }

  const managerIds = await getManagerUserIds(admin, companyId)
  if (managerIds.length === 0) return { data: { notified: 0, scanned: items.length }, error: null }

  let notified = 0
  for (const item of items) {
    if (await wasRecentlyNotified(admin, companyId, item.id)) continue
    const statusLabel = item.daysUntil < 0 ? "expired" : `expires in ${item.daysUntil}d`
    for (const userId of managerIds) {
      await sendNotification(userId, "document_expiry", {
        company_id: companyId,
        title: `Document expiry: ${item.label}`,
        message: `${item.label} (${item.type}) ${statusLabel} on ${item.expiryDate}.`,
        priority: item.daysUntil <= 7 || item.daysUntil < 0 ? "high" : "medium",
        event: "document_expiry",
        item_id: item.id,
        item_type: item.type,
        expiry_date: item.expiryDate,
      })
    }
    notified += 1
  }

  return { data: { notified, scanned: items.length }, error: null }
}

export async function scanAllDocumentExpiryAlerts(): Promise<{
  data: { companies: number; notified: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const { data: companies, error } = await admin.from("companies").select("id").limit(5000)
  if (error) return { data: null, error: error.message }

  const companyIds = (companies || []).map((r) => String(r.id)).filter(Boolean)
  const results = await batchOperations(companyIds, 8, scanDocumentExpiryForCompany)
  const notified = results.reduce((sum, r) => sum + (r.data?.notified ?? 0), 0)
  return { data: { companies: companyIds.length, notified }, error: null }
}
