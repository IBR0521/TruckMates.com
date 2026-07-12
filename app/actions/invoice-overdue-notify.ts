// NOT a "use server" module (F9): these are cron workers that take a companyId and run on the
// service-role admin client. As server actions, any authenticated user could invoke them for an
// arbitrary company (cross-tenant side effects). Imported only by cron routes / the agent executor.

import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotification } from "@/app/actions/notifications"
import { batchOperations } from "@/lib/performance"
import {
  FINANCE_NOTIFICATION_SETTINGS_SELECT,
  isFinanceNotifyEventEnabled,
  type FinanceNotificationSettings,
} from "@/lib/finance-notify-settings"

const FINANCE_ROLES = new Set(["super_admin", "operations_manager", "financial_controller"])
const DEDUPE_HOURS = 48

async function getFinanceUserIds(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data } = await admin
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .in("role", ["super_admin", "operations_manager", "financial_controller"])
  return (data || [])
    .filter((u: { role?: string | null }) => FINANCE_ROLES.has(String(u.role || "")))
    .map((u: { id: string }) => u.id)
}

async function wasRecentlyReminded(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  invoiceId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", since)
    .filter("metadata->>event", "eq", "invoice_overdue")
    .filter("metadata->>invoice_id", "eq", invoiceId)
  return (count ?? 0) > 0
}

export async function scanInvoiceOverdueForCompany(companyId: string): Promise<{
  data: { marked: number; reminded: number; scanned: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const { data: settings } = await admin
    .from("company_settings")
    .select(FINANCE_NOTIFICATION_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()
  const financeSettings = (settings as FinanceNotificationSettings | null) ?? null

  const { data: reminderSettings } = await admin
    .from("company_reminder_settings")
    .select("invoice_reminders")
    .eq("company_id", companyId)
    .maybeSingle()

  const invoiceRemindersEnabled = reminderSettings?.invoice_reminders !== false
  const notifyOverdue = isFinanceNotifyEventEnabled(financeSettings, "invoice_overdue")

  const { data: overdueCandidates, error } = await admin
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, status, due_date")
    .eq("company_id", companyId)
    .in("status", ["pending", "sent"])
    .lt("due_date", today)
    .limit(500)

  if (error) return { data: null, error: error.message }

  let marked = 0
  let reminded = 0
  const financeUserIds = await getFinanceUserIds(admin, companyId)

  for (const inv of overdueCandidates || []) {
    const invoiceId = String(inv.id || "")
    if (!invoiceId) continue

    const { error: updateError } = await admin
      .from("invoices")
      .update({ status: "overdue" })
      .eq("id", invoiceId)
      .eq("company_id", companyId)
      .in("status", ["pending", "sent"])

    if (!updateError) {
      marked += 1
      try {
        const { triggerWebhook } = await import("./webhooks")
        await triggerWebhook(companyId, "invoice.overdue", {
          invoice_id: invoiceId,
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          customer_name: inv.customer_name,
          due_date: inv.due_date,
        })
      } catch {
        // non-fatal
      }
    }

    if (!notifyOverdue || !invoiceRemindersEnabled) continue
    if (financeUserIds.length === 0) continue
    if (await wasRecentlyReminded(admin, companyId, invoiceId)) continue

    for (const userId of financeUserIds) {
      await sendNotification(userId, "payment_reminder", {
        company_id: companyId,
        title: `Invoice overdue: ${inv.invoice_number || invoiceId}`,
        message: `Invoice ${inv.invoice_number || invoiceId} for ${inv.customer_name || "customer"} is past due (${inv.due_date}). Amount: $${Number(inv.amount || 0).toFixed(2)}.`,
        priority: "high",
        event: "invoice_overdue",
        invoice_id: invoiceId,
      })
    }
    reminded += 1
  }

  return {
    data: { marked, reminded, scanned: (overdueCandidates || []).length },
    error: null,
  }
}

export async function scanAllInvoiceOverdue(): Promise<{
  data: { companies: number; marked: number; reminded: number } | null
  error: string | null
}> {
  const admin = createAdminClient()
  const { data: companies, error } = await admin.from("companies").select("id").limit(5000)
  if (error) return { data: null, error: error.message }

  const companyIds = (companies || []).map((r) => String(r.id)).filter(Boolean)
  const results = await batchOperations(companyIds, 6, scanInvoiceOverdueForCompany)
  const marked = results.reduce((sum, r) => sum + (r.data?.marked ?? 0), 0)
  const reminded = results.reduce((sum, r) => sum + (r.data?.reminded ?? 0), 0)
  return { data: { companies: companyIds.length, marked, reminded }, error: null }
}
