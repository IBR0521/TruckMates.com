import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return String(value || "").trim()
}

function canReverse(logRow: Record<string, unknown>, now = Date.now()): { allowed: boolean; reason: string | null } {
  const createdAt = new Date(text(logRow.created_at))
  if (!Number.isFinite(createdAt.getTime())) return { allowed: false, reason: "Invalid log timestamp" }

  const ageMs = now - createdAt.getTime()
  const maxAgeMs = 30 * 60 * 1000
  if (ageMs > maxAgeMs) {
    return { allowed: false, reason: "Only actions from the last 30 minutes can be reversed" }
  }

  if (logRow.reversed_at) {
    return { allowed: false, reason: "Action already reversed" }
  }

  const payload = toRecord(logRow.action_payload)
  const nestedAction = toRecord(payload._agentAction)
  const reversible =
    typeof nestedAction.reversible === "boolean"
      ? nestedAction.reversible
      : typeof payload.reversible === "boolean"
        ? Boolean(payload.reversible)
        : false

  if (!reversible) {
    return { allowed: false, reason: "This action is not reversible" }
  }

  return { allowed: true, reason: null }
}

async function reverseAction(logRow: Record<string, unknown>): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  const payload = toRecord(logRow.action_payload)
  const nestedAction = toRecord(payload._agentAction)
  const actionType = text(logRow.action_taken || nestedAction.type || logRow.automation_type)
  const actionPayload = toRecord(nestedAction.payload || payload)
  const companyId = text(logRow.company_id || nestedAction.companyId || actionPayload.companyId)

  if (!companyId) return { success: false, error: "Missing company context for reversal" }

  if (actionType === "driver_assignment") {
    const loadId = text(actionPayload.loadId || actionPayload.load_id)
    if (!loadId) return { success: false, error: "Missing loadId for driver assignment reversal" }

    const previousStatus = text(actionPayload.previousStatus || actionPayload.previous_status || "pending")
    const { error } = await admin
      .from("loads")
      .update({
        driver_id: null,
        truck_id: null,
        status: previousStatus,
      } as never)
      .eq("company_id", companyId)
      .eq("id", loadId)

    return { success: !error, error: error?.message || null }
  }

  if (actionType === "invoice_auto_generation") {
    const invoiceId = text(actionPayload.invoiceId || actionPayload.invoice_id)
    if (!invoiceId) return { success: false, error: "Missing invoiceId for invoice reversal" }

    const { error } = await admin
      .from("invoices")
      .update({ status: "cancelled" } as never)
      .eq("company_id", companyId)
      .eq("id", invoiceId)

    return { success: !error, error: error?.message || null }
  }

  if (actionType === "detention_clock") {
    const zoneVisitId = text(actionPayload.zoneVisitId || actionPayload.zone_visit_id)
    if (zoneVisitId) {
      const detentionModule = await import("@/app/actions/detention-tracking")
      const stopDetentionTimerFn =
        (detentionModule as Record<string, unknown>).stopDetentionTimer ||
        (detentionModule as Record<string, unknown>).finalizeDetention

      if (typeof stopDetentionTimerFn === "function") {
        const response = await (stopDetentionTimerFn as (zoneVisitId: string) => Promise<{ error?: string }>)(
          zoneVisitId
        )
        if (response?.error) return { success: false, error: String(response.error) }
        return { success: true, error: null }
      }
    }

    const detentionId = text(actionPayload.detentionId || actionPayload.detention_id)
    if (!detentionId) return { success: false, error: "Missing detention reference for detention reversal" }

    const { error } = await admin
      .from("detention_tracking")
      .update({
        status: "completed",
        exit_timestamp: new Date().toISOString(),
      } as never)
      .eq("company_id", companyId)
      .eq("id", detentionId)

    return { success: !error, error: error?.message || null }
  }

  if (actionType === "load_status_auto_update" || actionType === "load_status_update") {
    const loadId = text(actionPayload.loadId || actionPayload.load_id)
    const previousStatus = text(actionPayload.previousStatus || actionPayload.previous_status)
    if (!loadId || !previousStatus) {
      return { success: false, error: "Missing loadId or previousStatus for load status reversal" }
    }

    const { error } = await admin
      .from("loads")
      .update({ status: previousStatus } as never)
      .eq("company_id", companyId)
      .eq("id", loadId)

    return { success: !error, error: error?.message || null }
  }

  if (actionType === "credit_hold") {
    const customerId = text(actionPayload.customerId || actionPayload.customer_id)
    if (!customerId) return { success: false, error: "Missing customerId for credit hold reversal" }

    const { error } = await admin
      .from("customers")
      .update({ credit_hold: false } as never)
      .eq("company_id", companyId)
      .eq("id", customerId)

    return { success: !error, error: error?.message || null }
  }

  return { success: false, error: `Unsupported reversal action type: ${actionType}` }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.user || !ctx.companyId) {
      return NextResponse.json({ success: false, error: ctx.error || "Not authenticated" }, { status: 401 })
    }

    const role = mapLegacyRole(ctx.user.role)
    if (!["operations_manager", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as { logId?: string }
    const logId = text(body.logId)
    if (!logId) {
      return NextResponse.json({ success: false, error: "logId is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: logEntry, error: logError } = await admin
      .from("ai_automation_logs")
      .select("id, company_id, automation_type, action_taken, action_payload, created_at, reversed_at")
      .eq("id", logId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (logError || !logEntry) {
      return NextResponse.json({ success: false, error: logError?.message || "Log entry not found" }, { status: 404 })
    }

    const permission = canReverse(logEntry as Record<string, unknown>)
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: permission.reason || "Cannot reverse action" }, { status: 400 })
    }

    const reversed = await reverseAction(logEntry as Record<string, unknown>)
    if (!reversed.success) {
      return NextResponse.json({ success: false, error: reversed.error || "Failed to reverse action" }, { status: 500 })
    }

    const { error: updateError } = await admin
      .from("ai_automation_logs")
      .update({ reversed_at: new Date().toISOString() } as never)
      .eq("id", logId)
      .eq("company_id", ctx.companyId)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message || "Failed to update reverse log" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
