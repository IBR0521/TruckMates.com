import { createAdminClient } from "@/lib/supabase/admin"
import {
  DISPATCH_NOTIFICATION_SETTINGS_SELECT,
  type DispatchNotificationSettings,
} from "@/lib/dispatch-notify-settings"
import { clearDeadline, upsertDeadline } from "@/lib/deadlines/scheduled-deadlines"

async function getDispatchSettingsForCompany(
  companyId: string,
): Promise<DispatchNotificationSettings | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("company_settings")
    .select(DISPATCH_NOTIFICATION_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()
  return (data as DispatchNotificationSettings | null) ?? null
}

export function checkCallMissedDeadlineAt(
  scheduledTime: string,
  timeoutMinutes: number,
): Date {
  const scheduled = new Date(scheduledTime)
  return new Date(scheduled.getTime() + Math.max(5, timeoutMinutes) * 60 * 1000)
}

export function emergencyEscalationDeadlineAt(
  createdAt: string,
  escalationMinutes: number,
): Date {
  const created = new Date(createdAt)
  return new Date(created.getTime() + Math.max(5, escalationMinutes) * 60 * 1000)
}

/** Driver late when status is still `scheduled` and `load_date` is in the past — deadline is `load_date`. */
export function driverLateDeadlineAt(loadDate: string): Date {
  return new Date(loadDate)
}

export async function syncCheckCallMissedDeadline(params: {
  companyId: string
  checkCallId: string
  scheduledTime: string
}): Promise<void> {
  const settings = await getDispatchSettingsForCompany(params.companyId)
  const timeoutMinutes = Math.max(5, Number(settings?.check_call_timeout_minutes) || 30)
  const deadlineAt = checkCallMissedDeadlineAt(params.scheduledTime, timeoutMinutes)
  await upsertDeadline(
    "check_call_missed",
    params.checkCallId,
    deadlineAt,
    "check_call_overdue",
  )
}

export async function syncEmergencyEscalationDeadline(params: {
  companyId: string
  checkCallId: string
  createdAt: string
}): Promise<void> {
  const settings = await getDispatchSettingsForCompany(params.companyId)
  const escalationMinutes = Math.max(5, Number(settings?.emergency_escalation_minutes) || 15)
  const deadlineAt = emergencyEscalationDeadlineAt(params.createdAt, escalationMinutes)
  await upsertDeadline(
    "emergency_escalation",
    params.checkCallId,
    deadlineAt,
    "unacknowledged_emergency",
  )
}

export async function syncDriverLateDeadline(loadId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: load } = await admin
    .from("loads")
    .select("id, company_id, status, load_date")
    .eq("id", loadId)
    .maybeSingle()

  if (!load) {
    await clearDeadline("driver_late", loadId)
    return
  }

  const row = load as { id: string; company_id: string; status: string | null; load_date: string | null }
  const status = String(row.status || "").toLowerCase()

  if (status === "scheduled" && row.load_date) {
    await upsertDeadline("driver_late", loadId, driverLateDeadlineAt(row.load_date), "pickup_overdue")
  } else {
    await clearDeadline("driver_late", loadId)
  }
}

export async function clearCheckCallDeadlines(checkCallId: string): Promise<void> {
  await clearDeadline("check_call_missed", checkCallId)
  await clearDeadline("emergency_escalation", checkCallId)
}
