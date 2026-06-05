/**
 * Side effects for newly detected / recurring ECM fault codes.
 * Only critical severity auto-creates maintenance — high sends alert only.
 */

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeDbError } from "@/lib/utils/error"
import { getCompanyTier } from "@/lib/plan-enforcement"
import { hasFeatureAccess } from "@/lib/plan-limits"

export type FaultCodeRow = {
  id: string
  company_id: string
  truck_id: string | null
  driver_id: string | null
  code: string
  description: string | null
  severity: string
  recommended_action: string | null
  occurrence_count: number
  first_seen_at: string
  linked_maintenance_id: string | null
}

const RECURRENCE_THRESHOLD = 5
const RECURRENCE_WINDOW_MS = 24 * 60 * 60 * 1000

async function insertCompanyAlert(params: {
  companyId: string
  title: string
  message: string
  eventType: string
  truckId: string | null
  driverId: string | null
  metadata: Record<string, unknown>
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from("alerts").insert({
    company_id: params.companyId,
    title: params.title,
    message: params.message,
    event_type: params.eventType,
    priority: "normal",
    status: "active",
    truck_id: params.truckId,
    driver_id: params.driverId,
    load_id: null,
    metadata: params.metadata,
  })
  if (error) {
    Sentry.captureMessage(`fault code alert failed: ${safeDbError(error)}`, { level: "warning" })
  }
}

async function truckLabel(admin: ReturnType<typeof createAdminClient>, truckId: string | null): Promise<string> {
  if (!truckId) return "Unknown truck"
  const { data } = await admin.from("trucks").select("truck_number").eq("id", truckId).maybeSingle()
  const n = (data as { truck_number?: string | null } | null)?.truck_number
  return n ? `Truck ${n}` : "Truck"
}

export async function handleNewFaultCode(params: {
  fault: FaultCodeRow
  isNewOccurrence: boolean
}): Promise<{ maintenanceCreated: boolean; notificationSent: boolean }> {
  const tier = await getCompanyTier(params.fault.company_id)
  if (!hasFeatureAccess(tier, "eld_fault_codes_advanced")) {
    return { maintenanceCreated: false, notificationSent: false }
  }

  const admin = createAdminClient()
  const truckName = await truckLabel(admin, params.fault.truck_id)
  const desc = params.fault.description || params.fault.code
  let maintenanceCreated = false
  let notificationSent = false

  if (params.isNewOccurrence && params.fault.severity === "critical" && params.fault.truck_id) {
    if (!params.fault.linked_maintenance_id) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const scheduledDate = tomorrow.toISOString().slice(0, 10)

      const { data: maint, error: mErr } = await admin
        .from("maintenance")
        .insert({
          company_id: params.fault.company_id,
          truck_id: params.fault.truck_id,
          service_type: "fault_code_investigation",
          scheduled_date: scheduledDate,
          status: "scheduled",
          priority: "high",
          notes: `Auto-created from critical fault ${params.fault.code}: ${desc}`,
        })
        .select("id")
        .maybeSingle()

      if (!mErr && maint) {
        const maintId = (maint as { id: string }).id
        await admin
          .from("eld_fault_codes")
          .update({ linked_maintenance_id: maintId, updated_at: new Date().toISOString() })
          .eq("id", params.fault.id)
        maintenanceCreated = true
      }
    }

    const unitLabel = truckName.startsWith("Truck ")
      ? `Unit ${truckName.slice(6)}`
      : truckName
    await insertCompanyAlert({
      companyId: params.fault.company_id,
      title: maintenanceCreated
        ? `Maintenance auto-scheduled: ${params.fault.code}`
        : `CRITICAL fault: ${params.fault.code}`,
      message: maintenanceCreated
        ? `Maintenance auto-scheduled for ${unitLabel} from critical fault ${params.fault.code} — ${desc}.`
        : `${truckName}: ${desc}. Review in Vehicle Health.`,
      eventType: "eld_fault_critical",
      truckId: params.fault.truck_id,
      driverId: params.fault.driver_id,
      metadata: {
        fault_code_id: params.fault.id,
        code: params.fault.code,
        severity: "critical",
        maintenance_created: maintenanceCreated,
      },
    })
    notificationSent = true
  } else if (params.isNewOccurrence && params.fault.severity === "high") {
    await insertCompanyAlert({
      companyId: params.fault.company_id,
      title: `High-severity fault: ${params.fault.code}`,
      message: `${truckName}: ${desc}. ${params.fault.recommended_action || "Review recommended action in Vehicle Health."}`,
      eventType: "eld_fault_high",
      truckId: params.fault.truck_id,
      driverId: params.fault.driver_id,
      metadata: { fault_code_id: params.fault.id, code: params.fault.code, severity: "high" },
    })
    notificationSent = true
  }

  const firstSeenMs = new Date(params.fault.first_seen_at).getTime()
  const withinWindow = Date.now() - firstSeenMs <= RECURRENCE_WINDOW_MS
  if (
    params.fault.occurrence_count >= RECURRENCE_THRESHOLD &&
    withinWindow &&
    params.fault.severity !== "low"
  ) {
    await insertCompanyAlert({
      companyId: params.fault.company_id,
      title: `Recurring fault: ${params.fault.code}`,
      message: `${truckName}: fault ${params.fault.code} occurred ${params.fault.occurrence_count} times in 24h — possible intermittent issue.`,
      eventType: "eld_fault_recurring",
      truckId: params.fault.truck_id,
      driverId: params.fault.driver_id,
      metadata: {
        fault_code_id: params.fault.id,
        code: params.fault.code,
        occurrence_count: params.fault.occurrence_count,
      },
    })
    notificationSent = true
  }

  return { maintenanceCreated, notificationSent }
}
