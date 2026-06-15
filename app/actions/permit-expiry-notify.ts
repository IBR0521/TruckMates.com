"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotification } from "@/app/actions/notifications"
import { batchOperations } from "@/lib/performance"
import {
  COMPLIANCE_NOTIFICATION_SETTINGS_SELECT,
  isComplianceNotifyEventEnabled,
  parseComplianceExpiryLeadDays,
  type ComplianceNotificationSettings,
} from "@/lib/compliance-notify-settings"

const MANAGER_ROLES = new Set(["super_admin", "operations_manager", "dispatcher"])
const DEDUPE_HOURS = 24

async function getManagerUserIds(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .in("role", ["super_admin", "operations_manager", "dispatcher"])
  return (data || [])
    .filter((u: { role?: string | null }) => MANAGER_ROLES.has(String(u.role || "")))
    .map((u: { id: string }) => u.id)
}

async function wasRecentlyNotified(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  permitId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", since)
    .filter("metadata->>event", "eq", "permit_expiry")
    .filter("metadata->>permit_id", "eq", permitId)
  return (count ?? 0) > 0
}

export async function scanPermitExpiryForCompany(companyId: string): Promise<{
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
  if (!isComplianceNotifyEventEnabled(notifySettings, "permit_expiry")) {
    return { data: { notified: 0, scanned: 0 }, error: null }
  }

  const leadDays = parseComplianceExpiryLeadDays(notifySettings?.compliance_expiry_lead_days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxLead = Math.max(...leadDays, 30)
  const future = new Date(today)
  future.setDate(future.getDate() + maxLead)

  const { data: permits } = await admin
    .from("permits")
    .select("id, permit_number, issuing_state, expiry_date, load_id")
    .eq("company_id", companyId)
    .not("expiry_date", "is", null)
    .gte("expiry_date", today.toISOString().split("T")[0])
    .lte("expiry_date", future.toISOString().split("T")[0])
    .limit(500)

  const managerIds = await getManagerUserIds(admin, companyId)
  let notified = 0

  for (const permit of permits || []) {
    const permitId = String(permit.id || "")
    if (!permitId) continue
    const expiry = new Date(String(permit.expiry_date))
    expiry.setHours(0, 0, 0, 0)
    const daysUntil = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (!leadDays.includes(daysUntil) && daysUntil >= 0) continue
    if (await wasRecentlyNotified(admin, companyId, permitId)) continue
    if (managerIds.length === 0) continue

    const label = permit.permit_number || permitId
    const state = permit.issuing_state ? ` (${permit.issuing_state})` : ""
    for (const userId of managerIds) {
      await sendNotification(userId, "document_expiry", {
        company_id: companyId,
        title: `Permit expiry: ${label}`,
        message: `Permit ${label}${state} expires in ${daysUntil} days (${permit.expiry_date}).`,
        priority: daysUntil <= 7 ? "high" : "medium",
        event: "permit_expiry",
        permit_id: permitId,
        load_id: permit.load_id,
        expiry_date: permit.expiry_date,
      })
    }
    notified += 1
  }

  return { data: { notified, scanned: (permits || []).length }, error: null }
}

export async function scanAllPermitExpiryAlerts(): Promise<{
  data: { companies: number; notified: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const { data: companies, error } = await admin.from("companies").select("id").limit(5000)
  if (error) return { data: null, error: error.message }

  const companyIds = (companies || []).map((r) => String(r.id)).filter(Boolean)
  const results = await batchOperations(companyIds, 8, scanPermitExpiryForCompany)
  const notified = results.reduce((sum, r) => sum + (r.data?.notified ?? 0), 0)
  return { data: { companies: companyIds.length, notified }, error: null }
}
