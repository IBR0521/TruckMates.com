"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import { createAuditLog } from "@/lib/audit-log"
import { errorMessage } from "@/lib/error-message"

type Jurisdiction = "gdpr" | "ccpa"
type RequestType = "access_export" | "deletion" | "rectification" | "restriction"
type RequestStatus = "pending" | "in_review" | "completed" | "rejected" | "cancelled" | "overdue"

export type DataSubjectRequestRow = {
  id: string
  company_id: string
  requester_user_id: string
  requester_name: string | null
  requester_email: string | null
  driver_id: string | null
  jurisdiction: Jurisdiction
  request_type: RequestType
  status: RequestStatus
  description: string | null
  response_notes: string | null
  verification_status: "self_authenticated" | "verified" | "failed"
  requested_at: string
  due_at: string
  completed_at: string | null
  completed_by: string | null
  export_payload?: Record<string, unknown> | null
}

function computeDueAt(jurisdiction: Jurisdiction): string {
  const days = jurisdiction === "gdpr" ? 30 : 45
  const due = new Date()
  due.setDate(due.getDate() + days)
  return due.toISOString()
}

function sanitizeDescription(value: string | null | undefined): string | null {
  const text = String(value || "").trim()
  return text.length ? text.slice(0, 2000) : null
}

function isManagerRole(role: string | null): boolean {
  return role === "super_admin" || role === "operations_manager" || role === "manager"
}

async function collectExportData(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  companyId: string
  requesterUserId: string
}): Promise<Record<string, unknown>> {
  const { supabase, companyId, requesterUserId } = input

  const [{ data: user }, { data: driver }] = await Promise.all([
    supabase
      .from("users")
      .select("id, company_id, email, name, full_name, phone, role, created_at, updated_at")
      .eq("id", requesterUserId)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("drivers")
      .select("id, company_id, name, email, phone, license_number, cdl_number, status, created_at, updated_at")
      .eq("company_id", companyId)
      .eq("user_id", requesterUserId)
      .maybeSingle(),
  ])

  const driverId = driver?.id ? String(driver.id) : null

  const [chatMessagesRes, contactHistoryRes, settlementsRes] = await Promise.all([
    driverId
      ? supabase
          .from("chat_messages")
          .select("id, thread_id, sender_id, message, message_type, metadata, created_at")
          .eq("company_id", companyId)
          .or(`sender_id.eq.${requesterUserId},metadata->>driver_id.eq.${driverId}`)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    driverId
      ? supabase
          .from("contact_history")
          .select("id, customer_id, subject, message, type, direction, source, sent_at, metadata")
          .eq("company_id", companyId)
          .or(`metadata->>driver_id.eq.${driverId},metadata->>user_id.eq.${requesterUserId}`)
          .order("sent_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    driverId
      ? supabase
          .from("settlements")
          .select("id, driver_id, period_start, period_end, gross_amount, deductions, net_amount, status, created_at")
          .eq("company_id", companyId)
          .eq("driver_id", driverId)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  return {
    generated_at: new Date().toISOString(),
    requester_user: user || null,
    requester_driver_profile: driver || null,
    chat_messages: chatMessagesRes.data || [],
    contact_history: contactHistoryRes.data || [],
    settlements: settlementsRes.data || [],
    legal_notice:
      "This export is generated for data-subject rights workflow. Some financial or third-party processor records may remain in retention systems as required by law.",
  }
}

export async function createDataSubjectRequest(input: {
  jurisdiction: Jurisdiction
  request_type: RequestType
  description?: string
}): Promise<{ success: boolean; error: string | null; data?: DataSubjectRequestRow }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.userId || !ctx.companyId) {
      return { success: false, error: ctx.error || "Not authenticated" }
    }

    const supabase = await createClient()
    const { data: me } = await supabase
      .from("users")
      .select("id, email, full_name, name")
      .eq("id", ctx.userId)
      .maybeSingle()

    const payload = {
      company_id: ctx.companyId,
      requester_user_id: ctx.userId,
      requester_name: (me?.full_name || me?.name || null) as string | null,
      requester_email: (me?.email || null) as string | null,
      jurisdiction: input.jurisdiction,
      request_type: input.request_type,
      description: sanitizeDescription(input.description),
      due_at: computeDueAt(input.jurisdiction),
      verification_status: "self_authenticated" as const,
      status: "pending" as const,
    }

    const { data, error } = await supabase
      .from("data_subject_requests")
      .insert(payload)
      .select("*")
      .single()
    if (error) return { success: false, error: error.message || "Failed to submit request" }

    await createAuditLog({
      action: "privacy.request.created",
      resource_type: "data_subject_request",
      resource_id: String(data.id),
      details: {
        jurisdiction: input.jurisdiction,
        request_type: input.request_type,
      },
    })

    return { success: true, error: null, data: data as DataSubjectRequestRow }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { success: false, error: errorMessage(error, "Failed to submit privacy request") }
  }
}

export async function getMyDataSubjectRequests(): Promise<{ data: DataSubjectRequestRow[]; error: string | null }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.userId || !ctx.companyId) return { data: [], error: ctx.error || "Not authenticated" }

    const supabase = await createClient()
    const nowIso = new Date().toISOString()
    await supabase
      .from("data_subject_requests")
      .update({ status: "overdue" })
      .eq("company_id", ctx.companyId)
      .in("status", ["pending", "in_review"])
      .lt("due_at", nowIso)

    const { data, error } = await supabase
      .from("data_subject_requests")
      .select("*")
      .eq("requester_user_id", ctx.userId)
      .order("requested_at", { ascending: false })
      .limit(100)
    if (error) return { data: [], error: error.message || "Failed to load requests" }
    return { data: (data || []) as DataSubjectRequestRow[], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: [], error: errorMessage(error, "Failed to load requests") }
  }
}

export async function getCompanyDataSubjectRequests(): Promise<{ data: DataSubjectRequestRow[]; error: string | null }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { data: [], error: ctx.error || "Not authenticated" }
    const role = await getUserRole()
    if (!isManagerRole(role)) return { data: [], error: "Only managers can review privacy requests." }

    const supabase = await createClient()
    const nowIso = new Date().toISOString()
    await supabase
      .from("data_subject_requests")
      .update({ status: "overdue" })
      .eq("company_id", ctx.companyId)
      .in("status", ["pending", "in_review"])
      .lt("due_at", nowIso)

    const { data, error } = await supabase
      .from("data_subject_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .order("requested_at", { ascending: false })
      .limit(300)

    if (error) return { data: [], error: error.message || "Failed to load requests" }
    return { data: (data || []) as DataSubjectRequestRow[], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: [], error: errorMessage(error, "Failed to load privacy requests") }
  }
}

export async function updateDataSubjectRequest(input: {
  id: string
  status: Extract<RequestStatus, "in_review" | "completed" | "rejected" | "cancelled">
  response_notes?: string
  attach_export_payload?: boolean
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) return { success: false, error: ctx.error || "Not authenticated" }
    const role = await getUserRole()
    if (!isManagerRole(role)) return { success: false, error: "Only managers can update privacy requests." }

    const supabase = await createClient()
    const { data: req, error: reqErr } = await supabase
      .from("data_subject_requests")
      .select("*")
      .eq("id", input.id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (reqErr || !req) return { success: false, error: reqErr?.message || "Request not found" }

    let exportPayload: Record<string, unknown> | null = null
    if (input.status === "completed" && input.attach_export_payload) {
      exportPayload = await collectExportData({
        supabase,
        companyId: ctx.companyId,
        requesterUserId: String(req.requester_user_id),
      })
    }

    const patch: Record<string, unknown> = {
      status: input.status,
      response_notes: sanitizeDescription(input.response_notes),
      updated_at: new Date().toISOString(),
      completed_by: input.status === "completed" ? ctx.userId : null,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
    }
    if (exportPayload) patch.export_payload = exportPayload

    const { error } = await supabase.from("data_subject_requests").update(patch).eq("id", input.id)
    if (error) return { success: false, error: error.message || "Failed to update request" }

    await createAuditLog({
      action: `privacy.request.${input.status}`,
      resource_type: "data_subject_request",
      resource_id: input.id,
      details: {
        response_notes: sanitizeDescription(input.response_notes),
        attach_export_payload: Boolean(input.attach_export_payload),
      },
    })

    return { success: true, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { success: false, error: errorMessage(error, "Failed to update privacy request") }
  }
}

export async function getDataSubjectExportPayload(requestId: string): Promise<{
  data: Record<string, unknown> | null
  error: string | null
}> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) return { data: null, error: ctx.error || "Not authenticated" }

    const role = await getUserRole()
    const supabase = await createClient()
    const { data: req, error } = await supabase
      .from("data_subject_requests")
      .select("id, company_id, requester_user_id, export_payload")
      .eq("id", requestId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (error || !req) return { data: null, error: error?.message || "Request not found" }

    const isOwner = String(req.requester_user_id) === String(ctx.userId)
    if (!isOwner && !isManagerRole(role)) return { data: null, error: "You do not have access to this export." }
    if (!req.export_payload || typeof req.export_payload !== "object") {
      return { data: null, error: "No export payload attached yet." }
    }
    return { data: req.export_payload as Record<string, unknown>, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { data: null, error: errorMessage(error, "Failed to load export payload") }
  }
}
