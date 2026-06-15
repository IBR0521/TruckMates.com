import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getDispatchGateErrors,
  isDispatchStatus,
  isDispatchTransition,
  type CompanyDispatchSettings,
} from "./dispatch-gates"
import { hasValidPermitAttachment } from "./permit-requirement"
import {
  ALL_LOAD_STATUSES,
  getAllowedNextLoadStatuses,
  normalizeLoadStatus,
  parseLoadStatus,
  type LoadStatus,
} from "./load-status"
import {
  OPERATIONS_WORKFLOW_SETTINGS_SELECT,
  parseRequiredStatuses,
  type OperationsWorkflowSettings,
} from "./load-workflow-settings"

export const PRE_DISPATCH_STATUSES = new Set<LoadStatus>(["draft", "pending", "confirmed"])

export const LOAD_REQUIRED_DOCUMENT_TYPES = [
  "bol",
  "pod",
  "pod_photo",
  "rate_confirmation",
  "insurance",
  "other",
] as const

export type CompanyDispatchSettingsExtended = CompanyDispatchSettings &
  Pick<OperationsWorkflowSettings, "dispatch_approval_required"> & {
    emergency_contact_required?: boolean | null
  }

export function canPromoteToScheduledOnAssign(status: unknown): boolean {
  return PRE_DISPATCH_STATUSES.has(normalizeLoadStatus(status))
}

export function isLoadStatusTransitionAllowed(
  currentStatus: unknown,
  nextStatus: unknown,
  allowStatusSkip: boolean,
  requiredStatuses?: unknown,
): { allowed: boolean; error: string | null } {
  const current = normalizeLoadStatus(currentStatus)
  const next = parseLoadStatus(nextStatus)
  if (!next) {
    return {
      allowed: false,
      error: `Invalid status "${String(nextStatus)}". Must be one of: ${ALL_LOAD_STATUSES.join(", ")}`,
    }
  }
  if (current === next) return { allowed: true, error: null }

  if (allowStatusSkip) {
    if (current === "completed" || current === "cancelled") {
      return {
        allowed: false,
        error: `Cannot change load status from "${current}".`,
      }
    }
    const required = parseRequiredStatuses(requiredStatuses)
    if (required.length > 0 && !required.includes(next)) {
      return {
        allowed: false,
        error: `Status "${next}" is not allowed. Required workflow statuses: ${required.join(", ")}.`,
      }
    }
    return { allowed: true, error: null }
  }

  const allowedNext = getAllowedNextLoadStatuses(current)
  if (!allowedNext.includes(next)) {
    return {
      allowed: false,
      error: `Invalid status transition: Cannot change load status from "${current}" to "${next}". Allowed transitions: ${allowedNext.join(", ") || "none"}`,
    }
  }
  return { allowed: true, error: null }
}

export function getDispatchApprovalError(
  currentStatus: string,
  nextStatus: string,
  dispatchApprovalRequired: boolean,
): string | null {
  if (!dispatchApprovalRequired) return null
  const current = normalizeLoadStatus(currentStatus)
  const next = String(nextStatus || "").toLowerCase()
  if (!isDispatchTransition(current, next)) return null
  if (isDispatchStatus(current)) return null
  if (current === "confirmed") return null
  return "Load must be confirmed before dispatch. Set status to Confirmed first."
}

async function isPreTripDvirRequired(
  supabase: SupabaseClient,
  truckId: string,
): Promise<{ required: boolean; error: string | null }> {
  const today = new Date().toISOString().split("T")[0]
  const { data, error } = await supabase.rpc("check_pre_trip_dvir_required", {
    p_truck_id: truckId,
    p_date: today,
  })
  if (error) {
    return { required: false, error: "Unable to verify pre-trip DVIR status. Try again." }
  }
  return { required: Boolean(data), error: null }
}

export type DispatchReadinessInput = {
  supabase: SupabaseClient
  companyId: string
  loadId: string | null
  currentStatus: string
  nextStatus: string
  requiresPermit: boolean
  truckId?: string | null
  driverId?: string | null
  settings?: CompanyDispatchSettingsExtended | null
}

/** Returns the first blocking error when moving onto the dispatch path, or null if ready. */
export async function getDispatchReadinessError(
  input: DispatchReadinessInput,
): Promise<string | null> {
  const current = String(input.currentStatus || "").toLowerCase()
  const next = String(input.nextStatus || "").toLowerCase()
  if (!isDispatchTransition(current, next)) return null

  let settings = input.settings
  if (!settings) {
    const { data } = await input.supabase
      .from("company_settings")
      .select(`${OPERATIONS_WORKFLOW_SETTINGS_SELECT}, emergency_contact_required`)
      .eq("company_id", input.companyId)
      .maybeSingle()
    settings = data as CompanyDispatchSettingsExtended | null
  }

  const approvalError = getDispatchApprovalError(
    current,
    next,
    Boolean(settings?.dispatch_approval_required),
  )
  if (approvalError) return approvalError

  let hasBol = false
  let attachedDocumentTypes: string[] = []
  if (input.loadId) {
    const [{ count: bolCount }, { data: loadDocs }] = await Promise.all([
      input.supabase
        .from("bols")
        .select("id", { count: "exact", head: true })
        .eq("company_id", input.companyId)
        .eq("load_id", input.loadId),
      input.supabase
        .from("documents")
        .select("type")
        .eq("company_id", input.companyId)
        .eq("load_id", input.loadId),
    ])
    hasBol = (bolCount ?? 0) > 0
    attachedDocumentTypes = (loadDocs || []).map((d: { type?: string | null }) =>
      String(d.type || ""),
    )
  }

  const gateErrors = getDispatchGateErrors({
    loadId: input.loadId || "new",
    currentStatus: current,
    nextStatus: next,
    settings,
    hasBol,
    attachedDocumentTypes,
  })
  if (gateErrors.length > 0) return gateErrors[0] ?? null

  if (input.requiresPermit && input.loadId) {
    const today = new Date().toISOString().split("T")[0]
    const { data: permits } = await input.supabase
      .from("permits")
      .select("id, expiry_date, document_id")
      .eq("company_id", input.companyId)
      .eq("load_id", input.loadId)
    if (!hasValidPermitAttachment(permits, today)) {
      return "Permit attachment is required before dispatching this load."
    }
  }

  const truckId = String(input.truckId ?? "").trim()
  if (truckId && isDispatchStatus(next)) {
    const dvir = await isPreTripDvirRequired(input.supabase, truckId)
    if (dvir.error) return dvir.error
    if (dvir.required) {
      return "Pre-trip DVIR is required for this truck before dispatch."
    }
  }

  const driverId = String(input.driverId ?? "").trim()
  if (driverId && settings?.emergency_contact_required !== false && isDispatchStatus(next)) {
    const { data: driver } = await input.supabase
      .from("drivers")
      .select("emergency_contact_name, emergency_contact_phone")
      .eq("id", driverId)
      .eq("company_id", input.companyId)
      .maybeSingle()
    const phone = String(driver?.emergency_contact_phone || "").trim()
    if (!phone) {
      return "Driver emergency contact phone is required before dispatch."
    }
  }

  return null
}

type RouteLinkedLoad = {
  id: string
  shipment_number?: string | null
  status?: string | null
  requires_permit?: boolean | null
}

/** Validate all pre-dispatch loads on a route before scheduling the route assignment. */
export async function getRouteLoadsDispatchReadinessError(
  supabase: SupabaseClient,
  companyId: string,
  routeId: string,
  truckId: string,
  driverId?: string | null,
): Promise<string | null> {
  const { data: loads, error } = await supabase
    .from("loads")
    .select("id, shipment_number, status, requires_permit")
    .eq("company_id", companyId)
    .eq("route_id", routeId)
    .in("status", ["draft", "pending", "confirmed"])

  if (error) {
    return "Unable to verify loads on this route. Try again."
  }

  for (const row of (loads || []) as RouteLinkedLoad[]) {
    const status = String(row.status || "").toLowerCase()
    if (!canPromoteToScheduledOnAssign(status)) continue

    const dispatchError = await getDispatchReadinessError({
      supabase,
      companyId,
      loadId: row.id,
      currentStatus: status,
      nextStatus: "scheduled",
      requiresPermit: Boolean(row.requires_permit),
      truckId,
      driverId,
    })
    if (dispatchError) {
      const label = row.shipment_number || row.id
      return `Load ${label}: ${dispatchError}`
    }
  }

  return null
}

/** Whether a confirmed load with driver + truck should auto-promote to scheduled. */
export function shouldAttemptAutoDispatchOnReady(
  settings: OperationsWorkflowSettings | null | undefined,
  load: {
    status?: string | null
    driver_id?: string | null
    truck_id?: string | null
  },
  changedFields: { status?: boolean; driver_id?: boolean; truck_id?: boolean },
): boolean {
  if (!settings?.auto_dispatch_on_ready) return false
  if (normalizeLoadStatus(load.status) !== "confirmed") return false
  if (!load.driver_id || !load.truck_id) return false
  return Boolean(changedFields.status || changedFields.driver_id || changedFields.truck_id)
}

export { OPERATIONS_WORKFLOW_SETTINGS_SELECT, parseRequiredStatuses }
