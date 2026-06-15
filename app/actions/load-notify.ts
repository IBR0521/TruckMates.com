import type { SupabaseClient } from "@supabase/supabase-js"
import { sendNotification } from "@/app/actions/notifications"
import { isFirstDispatchTransition } from "@/lib/dispatch-notify-settings"
import {
  isLoadNotifyEventEnabled,
  type LoadNotifyEvent,
} from "@/lib/load-operations-notify"
import { OPERATIONS_WORKFLOW_SETTINGS_SELECT, type OperationsWorkflowSettings } from "@/lib/load-workflow-settings"

type LoadNotifyPayload = {
  driver_id?: string | null
  shipment_number?: string | null
  status?: string | null
  origin?: string | null
  destination?: string | null
}

/** Notify relevant users for a load operations event (non-blocking callers should .catch). */
export async function notifyLoadOperationsEvent(
  supabase: SupabaseClient,
  companyId: string,
  load: LoadNotifyPayload,
  event: LoadNotifyEvent,
  options?: { previousStatus?: string | null; company_id?: string },
): Promise<void> {
  const { data: settings } = await supabase
    .from("company_settings")
    .select(OPERATIONS_WORKFLOW_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()

  const opsSettings = settings as OperationsWorkflowSettings | null

  if (event === "dispatched") {
    if (!isFirstDispatchTransition(options?.previousStatus, load.status)) return
    if (!isLoadNotifyEventEnabled(opsSettings, "dispatched")) return
  } else if (!isLoadNotifyEventEnabled(opsSettings, event)) {
    return
  }

  let assignedDriverUserId: string | null = null
  if (load.driver_id) {
    const { data: driver } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", load.driver_id)
      .eq("company_id", companyId)
      .maybeSingle()
    assignedDriverUserId = driver?.user_id ?? null
  }

  const { data: relevantUsers } = await supabase
    .from("users")
    .select("id, role")
    .eq("company_id", companyId)
    .or(
      [
        assignedDriverUserId ? `id.eq.${assignedDriverUserId}` : "",
        "role.in.(super_admin,operations_manager,dispatcher,safety_compliance)",
      ]
        .filter(Boolean)
        .join(","),
    )

  if (!relevantUsers?.length) return

  const title =
    event === "dispatched"
      ? `Dispatched: ${load.shipment_number || "Load"}`
      : undefined
  const message =
    event === "dispatched"
      ? `Load ${load.shipment_number || "assigned"} is now ${String(load.status || "scheduled")}.`
      : undefined

  await Promise.all(
    relevantUsers.map(async (user: { id: string }) => {
      await sendNotification(user.id, "load_update", {
        company_id: options?.company_id ?? companyId,
        shipmentNumber: load.shipment_number ?? undefined,
        status: load.status ?? undefined,
        origin: load.origin ?? undefined,
        destination: load.destination ?? undefined,
        title,
        message,
        event,
      })
    }),
  )
}
