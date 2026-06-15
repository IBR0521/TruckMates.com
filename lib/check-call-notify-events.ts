export type CheckCallNotifyEvent =
  | "trip_start"
  | "at_shipper"
  | "pickup_completed"
  | "enroute"
  | "at_consignee"
  | "dropoff_completed"

export type CheckCallNotifySettings = {
  check_call_notify_customer?: boolean | null
  check_call_notify_broker?: boolean | null
  check_call_notify_on_trip_start?: boolean | null
  check_call_notify_at_shipper?: boolean | null
  check_call_notify_pickup_completed?: boolean | null
  check_call_notify_enroute?: boolean | null
  check_call_notify_at_consignee?: boolean | null
  check_call_notify_dropoff_completed?: boolean | null
}

const SETTING_BY_EVENT: Record<CheckCallNotifyEvent, keyof CheckCallNotifySettings> = {
  trip_start: "check_call_notify_on_trip_start",
  at_shipper: "check_call_notify_at_shipper",
  pickup_completed: "check_call_notify_pickup_completed",
  enroute: "check_call_notify_enroute",
  at_consignee: "check_call_notify_at_consignee",
  dropoff_completed: "check_call_notify_dropoff_completed",
}

export const CHECK_CALL_NOTIFY_EVENT_LABELS: Record<CheckCallNotifyEvent, string> = {
  trip_start: "Trip starting",
  at_shipper: "At shipper",
  pickup_completed: "Pickup completed",
  enroute: "En route",
  at_consignee: "At consignee",
  dropoff_completed: "Drop-off completed",
}

export function isCheckCallNotifyEventEnabled(
  settings: CheckCallNotifySettings | null | undefined,
  event: CheckCallNotifyEvent,
): boolean {
  if (!settings?.check_call_notify_customer) return false
  return Boolean(settings[SETTING_BY_EVENT[event]])
}

/** Map a completed check call to customer/broker notification events. */
export function resolveCheckCallCompletedEvents(
  callType: string,
  driverStatus?: string | null,
): CheckCallNotifyEvent[] {
  const type = String(callType || "").toLowerCase()
  const ds = String(driverStatus || "").toLowerCase().replace(/[\s-]+/g, "_")
  const events: CheckCallNotifyEvent[] = []

  if (type === "pickup") {
    if (!ds || ds.includes("shipper") || ds.includes("at_pickup")) events.push("at_shipper")
    if (!ds || ds.includes("loaded") || ds.includes("depart") || ds.includes("pickup")) {
      events.push("pickup_completed")
    }
    if (events.length === 0) events.push("at_shipper", "pickup_completed")
  } else if (type === "scheduled" || type === "milestone") {
    events.push("enroute")
  } else if (type === "delivery") {
    if (!ds || ds.includes("consignee") || ds.includes("at_delivery")) events.push("at_consignee")
    if (!ds || ds.includes("delivered") || ds.includes("drop") || ds.includes("unload")) {
      events.push("dropoff_completed")
    }
    if (events.length === 0) events.push("at_consignee", "dropoff_completed")
  }

  return [...new Set(events)]
}
