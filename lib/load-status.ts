export const ALL_LOAD_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "scheduled",
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
] as const

export type LoadStatus = (typeof ALL_LOAD_STATUSES)[number]

export const LOAD_STATUS_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  draft: ["pending", "scheduled", "cancelled"],
  pending: ["draft", "confirmed", "scheduled", "cancelled"],
  confirmed: ["scheduled", "cancelled", "pending"],
  scheduled: ["in_transit", "confirmed", "pending", "draft", "cancelled"],
  in_transit: ["delivered", "scheduled", "cancelled"],
  delivered: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function parseLoadStatus(status: unknown): LoadStatus | null {
  const s = String(status || "").toLowerCase()
  return (ALL_LOAD_STATUSES as readonly string[]).includes(s) ? (s as LoadStatus) : null
}

export function normalizeLoadStatus(status: unknown): LoadStatus {
  return parseLoadStatus(status) ?? "pending"
}

export function getAllowedNextLoadStatuses(currentStatus: unknown): LoadStatus[] {
  const normalized = normalizeLoadStatus(currentStatus)
  return LOAD_STATUS_TRANSITIONS[normalized] || []
}

