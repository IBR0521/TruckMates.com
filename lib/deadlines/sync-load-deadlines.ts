import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_FREE_MINUTES,
  DETENTION_ACTIVE_LOAD_STATUSES,
  DETENTION_RECHECK_MINUTES,
  LOAD_ARRIVAL_STATUSES,
  LOAD_DEPARTURE_OR_DONE_STATUSES,
  fetchCustomerDetentionDefaults,
  type DetentionLoadRow,
} from "@/lib/detention/dwell-scan"
import { clearDeadline, upsertDeadline } from "@/lib/deadlines/scheduled-deadlines"
import {
  DELIVERY_DELAY_ACTIVE_STATUSES,
  isLoadPastEstimatedDelivery,
} from "@/lib/delivery-delay-scan"

const LOAD_DEADLINE_SELECT =
  "id, company_id, status, customer_id, estimated_delivery, truck_id, driver_id"

export async function syncLoadDeadlinesForLoad(loadId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: load } = await admin
    .from("loads")
    .select(LOAD_DEADLINE_SELECT)
    .eq("id", loadId)
    .maybeSingle()

  if (!load) return

  const row = load as {
    id: string
    company_id: string
    status: string | null
    customer_id: string | null
    estimated_delivery: string | null
  }

  const status = String(row.status || "").toLowerCase()

  // Delivery delay deadline
  if (
    row.estimated_delivery &&
    DELIVERY_DELAY_ACTIVE_STATUSES.includes(
      status as (typeof DELIVERY_DELAY_ACTIVE_STATUSES)[number],
    )
  ) {
    await upsertDeadline("load_delivery", loadId, row.estimated_delivery, "eta_passed")
  } else {
    await clearDeadline("load_delivery", loadId)
  }

  // Detention deadline — set on arrival-at-stop, clear on departure/delivery
  if (LOAD_DEPARTURE_OR_DONE_STATUSES.has(status) || status === "delivered") {
    await clearDeadline("load_detention", loadId)
  } else if (LOAD_ARRIVAL_STATUSES.has(status)) {
    const customerId = String(row.customer_id || "").trim()
    const defaults = await fetchCustomerDetentionDefaults(
      admin,
      row.company_id,
      customerId ? [customerId] : [],
    )
    const freeMinutes = customerId
      ? (defaults.get(customerId)?.freeMinutes ?? DEFAULT_FREE_MINUTES)
      : DEFAULT_FREE_MINUTES
    const arrivalAt = new Date()
    const deadlineAt = new Date(arrivalAt.getTime() + freeMinutes * 60 * 1000)
    await upsertDeadline("load_detention", loadId, deadlineAt, "detention_free_time_expired")
  }

  const { syncDriverLateDeadline } = await import("@/lib/deadlines/sync-dispatch-deadlines")
  await syncDriverLateDeadline(loadId)
}

export async function syncLoadDeadlinesOnArrival(params: {
  loadId: string
  arrivalAt?: Date
}): Promise<void> {
  const admin = createAdminClient()
  const { data: load } = await admin
    .from("loads")
    .select("id, company_id, customer_id, status")
    .eq("id", params.loadId)
    .maybeSingle()

  if (!load) return

  const row = load as { id: string; company_id: string; customer_id: string | null; status: string | null }
  const customerId = String(row.customer_id || "").trim()
  const defaults = await fetchCustomerDetentionDefaults(
    admin,
    row.company_id,
    customerId ? [customerId] : [],
  )
  const freeMinutes = customerId
    ? (defaults.get(customerId)?.freeMinutes ?? DEFAULT_FREE_MINUTES)
    : DEFAULT_FREE_MINUTES

  const arrivalAt = params.arrivalAt ?? new Date()
  const deadlineAt = new Date(arrivalAt.getTime() + freeMinutes * 60 * 1000)
  await upsertDeadline("load_detention", params.loadId, deadlineAt, "detention_free_time_expired")
}

export async function fetchActiveLoadForTruck(
  companyId: string,
  truckId: string,
): Promise<DetentionLoadRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("loads")
    .select(
      "id, company_id, status, truck_id, driver_id, shipment_number, customer_id, origin, destination, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, shipper_latitude, shipper_longitude, consignee_latitude, consignee_longitude",
    )
    .eq("company_id", companyId)
    .eq("truck_id", truckId)
    .in("status", [...DETENTION_ACTIVE_LOAD_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as DetentionLoadRow | null) ?? null
}

export function nextDetentionRecheckDeadline(): Date {
  return new Date(Date.now() + DETENTION_RECHECK_MINUTES * 60 * 1000)
}

export function isLoadStillDelayed(
  estimatedDelivery: string | null | undefined,
  status: string | null | undefined,
): boolean {
  const s = String(status || "").toLowerCase()
  return (
    DELIVERY_DELAY_ACTIVE_STATUSES.includes(s as (typeof DELIVERY_DELAY_ACTIVE_STATUSES)[number]) &&
    isLoadPastEstimatedDelivery(estimatedDelivery)
  )
}
