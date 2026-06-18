import { createAdminClient } from "@/lib/supabase/admin"

export type ScheduledDeadlineEntityType =
  | "driver_hos"
  | "load_detention"
  | "load_delivery"
  | "check_call_missed"
  | "driver_late"
  | "emergency_escalation"

export type ScheduledDeadlineRow = {
  id: string
  entity_type: ScheduledDeadlineEntityType
  entity_id: string
  deadline_at: string
  deadline_reason: string
  status: "pending" | "resolved"
  created_at: string
  updated_at: string
}

export async function upsertDeadline(
  entityType: ScheduledDeadlineEntityType,
  entityId: string,
  deadlineAt: Date | string,
  reason: string,
): Promise<void> {
  const admin = createAdminClient()
  const at =
    deadlineAt instanceof Date ? deadlineAt.toISOString() : new Date(deadlineAt).toISOString()
  const now = new Date().toISOString()

  const { error } = await admin.from("scheduled_deadlines").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      deadline_at: at,
      deadline_reason: reason,
      status: "pending",
      updated_at: now,
    },
    { onConflict: "entity_type,entity_id" },
  )

  if (error) throw error
}

/** Entity no longer needs tracking — remove the row (matches ephemeral correlation tables like sso_pending_requests). */
export async function clearDeadline(
  entityType: ScheduledDeadlineEntityType,
  entityId: string,
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("scheduled_deadlines")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
}

export async function resolveDeadline(
  entityType: ScheduledDeadlineEntityType,
  entityId: string,
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("scheduled_deadlines")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
}

export async function fetchDueDeadlines(now: Date = new Date()): Promise<ScheduledDeadlineRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("scheduled_deadlines")
    .select("id, entity_type, entity_id, deadline_at, deadline_reason, status, created_at, updated_at")
    .eq("status", "pending")
    .lte("deadline_at", now.toISOString())
    .order("deadline_at", { ascending: true })
    .limit(500)

  if (error) throw error
  return (data || []) as ScheduledDeadlineRow[]
}
