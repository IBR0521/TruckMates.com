"use server"

import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"
export type UnifiedCommunicationEvent = {
  id: string
  occurred_at: string
  channel: "chat" | "sms" | "email" | "system" | "note"
  direction: "inbound" | "outbound"
  subject?: string | null
  message: string | null
  author_label?: string | null
  source: {
    table: "chat_messages" | "contact_history" | "communication_events"
    id: string
  }
  metadata?: Record<string, unknown>
}

type CommunicationThreadRow = {
  id: string
  company_id: string
  driver_id: string | null
  customer_id: string | null
  title: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {}

const asMetadata = (value: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : fallback

export async function getOrCreateCommunicationThread(
  input: { driver_id?: string; customer_id?: string }
): Promise<{ data: CommunicationThreadRow | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    if (!!input.driver_id === !!input.customer_id) {
      return { error: "Provide either driver_id or customer_id", data: null }
    }

    let query = supabase
      .from("communication_threads")
      .select("id, company_id, driver_id, customer_id, title, created_by, created_at, updated_at")
      .eq("company_id", ctx.companyId)
      .limit(1)

    if (input.driver_id) query = query.eq("driver_id", input.driver_id)
    if (input.customer_id) query = query.eq("customer_id", input.customer_id)

    const { data: existing, error: existingError } = await query.maybeSingle()
    if (existingError) return { error: safeDbError(existingError), data: null }
    if (existing) return { data: existing, error: null }

    const title = input.driver_id ? "Driver communications" : "Customer communications"

    const { data: created, error: createError } = await supabase
      .from("communication_threads")
      .insert({
        company_id: ctx.companyId,
        driver_id: input.driver_id || null,
        customer_id: input.customer_id || null,
        title,
        created_by: ctx.userId,
      })
      .select("id, company_id, driver_id, customer_id, title, created_by, created_at, updated_at")
      .single()

    if (createError || !created) return { error: safeDbError(createError), data: null }
    return { data: created, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create thread"), data: null }
  }
}

export async function getUnifiedCommunicationTimeline(input: {
  driver_id?: string
  customer_id?: string
  limit?: number
}): Promise<{ data: UnifiedCommunicationEvent[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    if (!!input.driver_id === !!input.customer_id) {
      return { error: "Provide either driver_id or customer_id", data: null }
    }

    const limit = Math.min(Math.max(input.limit || 200, 20), 500)

    // Ensure thread exists (needed for future event logs).
    const thread = await getOrCreateCommunicationThread({
      driver_id: input.driver_id,
      customer_id: input.customer_id,
    })
    if (thread.error || !thread.data?.id) return { error: thread.error || "Thread not available", data: null }
    const threadId = String(thread.data.id)

    const events: UnifiedCommunicationEvent[] = []

    // 1) Driver chat messages (includes inbound SMS webhook + outbound SMS we will log into chat)
    if (input.driver_id) {
      const { data: threadRow } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("driver_id", input.driver_id)
        .eq("thread_type", "driver")
        .limit(1)
        .maybeSingle()

      if (threadRow?.id) {
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("id, sender_id, message, message_type, created_at")
          .eq("company_id", ctx.companyId)
          .eq("thread_id", threadRow.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(limit)

        for (const m of msgs || []) {
          const mRec = asRecord(m)
          const mt = String(mRec.message_type || "text")
          const channel: UnifiedCommunicationEvent["channel"] =
            mt.includes("sms") ? "sms" : mt === "system" ? "system" : "chat"
          const direction: UnifiedCommunicationEvent["direction"] = mt === "sms_inbound" ? "inbound" : "outbound"
          events.push({
            id: `chat:${String(mRec.id)}`,
            occurred_at: String(mRec.created_at),
            channel,
            direction,
            message: String(mRec.message || ""),
            source: { table: "chat_messages", id: String(mRec.id) },
            metadata: { message_type: mt, sender_id: mRec.sender_id },
          })
        }
      }
    }

    // 2) Customer communications (CRM contact_history)
    if (input.customer_id) {
      const { data: rows } = await supabase
        .from("contact_history")
        .select("id, type, subject, message, direction, occurred_at, source, external_id, metadata, user_id")
        .eq("company_id", ctx.companyId)
        .eq("customer_id", input.customer_id)
        .order("occurred_at", { ascending: false })
        .limit(limit)

      for (const r of rows || []) {
        const rRec = asRecord(r)
        const t = String(rRec.type || "")
        const channel: UnifiedCommunicationEvent["channel"] =
          t === "sms" ? "sms" : t === "email" || t === "invoice_sent" ? "email" : "note"
        events.push({
          id: `crm:${String(rRec.id)}`,
          occurred_at: String(rRec.occurred_at || rRec.created_at),
          channel,
          direction: String(rRec.direction || "outbound") === "inbound" ? "inbound" : "outbound",
          subject: (rRec.subject ?? null) as string | null,
          message: (rRec.message ?? null) as string | null,
          source: { table: "contact_history", id: String(rRec.id) },
          metadata: asMetadata(rRec.metadata, { source: rRec.source, external_id: rRec.external_id }),
        })
      }
    }

    // 3) Thread-specific event logs (optional, future-proof)
    const { data: logged } = await supabase
      .from("communication_events")
      .select("id, event_type, direction, subject, message, occurred_at, metadata")
      .eq("company_id", ctx.companyId)
      .eq("thread_id", threadId)
      .order("occurred_at", { ascending: false })
      .limit(limit)

    for (const r of logged || []) {
      const rRec = asRecord(r)
      const et = String(rRec.event_type || "")
      const channel: UnifiedCommunicationEvent["channel"] =
        et.includes("sms") ? "sms" : et.includes("email") ? "email" : et.includes("status") ? "system" : "note"
      events.push({
        id: `log:${String(rRec.id)}`,
        occurred_at: String(rRec.occurred_at),
        channel,
        direction: String(rRec.direction || "outbound") === "inbound" ? "inbound" : "outbound",
        subject: (rRec.subject ?? null) as string | null,
        message: (rRec.message ?? null) as string | null,
        source: { table: "communication_events", id: String(rRec.id) },
        metadata: asMetadata(rRec.metadata),
      })
    }

    const merged = events
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
      .slice(0, limit)

    return { data: merged, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load unified communications"), data: null }
  }
}

