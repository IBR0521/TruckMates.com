import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapLegacyRole } from "@/lib/roles"

function normalizePhone(raw: string | null): string {
  const value = String(raw || "").trim()
  if (!value) return ""
  if (value.startsWith("+")) return value.replace(/\s/g, "")
  const digits = value.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits ? `+${digits}` : ""
}

function plainTwimlResponse(message = "OK") {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const twilioSig = request.headers.get("x-twilio-signature") || ""
    const twilioToken = process.env.TWILIO_AUTH_TOKEN || ""
    if (!twilioToken || !twilioSig) {
      return NextResponse.json({ error: "Unauthorized webhook request" }, { status: 403 })
    }

    const forwardedProto = request.headers.get("x-forwarded-proto")
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host")
    const fullUrl = forwardedHost
      ? `${forwardedProto || "https"}://${forwardedHost}${new URL(request.url).pathname}`
      : request.url
    const params: Record<string, string> = {}
    for (const [key, value] of form.entries()) {
      params[key] = String(value)
    }

    const twilioModule = await import("twilio").catch(() => null)
    const isValid = twilioModule?.validateRequest
      ? twilioModule.validateRequest(twilioToken, twilioSig, fullUrl, params)
      : false
    if (!isValid) {
      return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 })
    }

    const from = normalizePhone(String(form.get("From") || ""))
    const body = String(form.get("Body") || "").trim()
    const messageSid = String(form.get("MessageSid") || "")

    if (!from || !body) {
      return plainTwimlResponse("Missing From/Body")
    }

    const supabase = createAdminClient()

    let { data: driver } = await supabase
      .from("drivers")
      .select("id, user_id, company_id, name, phone, normalized_phone")
      .eq("normalized_phone", from)
      .maybeSingle()

    if (!driver?.id || !driver?.company_id) {
      Sentry.captureMessage(`[Twilio Inbound] driver not found for ${from}`, "info")
      return plainTwimlResponse("Driver not found")
    }

    // Sender user is required by chat_messages.sender_id.
    let senderUserId = driver.user_id ? String(driver.user_id) : null
    if (!senderUserId) {
      const { data: userByPhone } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", driver.company_id)
        .or(`phone.eq.${from},phone.eq.${String(form.get("From") || "").trim()}`)
        .maybeSingle()
      senderUserId = userByPhone?.id ? String(userByPhone.id) : null
    }
    if (!senderUserId) {
      Sentry.captureMessage(`[Twilio Inbound] sender user missing for driver ${driver.id}`, "warning")
      return plainTwimlResponse("Driver account not linked")
    }

    // Participants: driver + dispatch-capable users.
    const { data: companyUsers } = await supabase
      .from("users")
      .select("id, role")
      .eq("company_id", driver.company_id)
      .limit(1000)

    const dispatcherUserIds = (companyUsers || [])
      .filter((u: any) => {
        const role = mapLegacyRole(String(u?.role || ""))
        return ["super_admin", "operations_manager", "dispatcher", "safety_compliance"].includes(role)
      })
      .map((u: any) => String(u.id))

    const participants = Array.from(new Set([senderUserId, ...dispatcherUserIds]))

    let { data: thread } = await supabase
      .from("chat_threads")
      .select("id, unread_count")
      .eq("company_id", driver.company_id)
      .eq("driver_id", driver.id)
      .eq("thread_type", "driver")
      .maybeSingle()

    if (!thread?.id) {
      const created = await supabase
        .from("chat_threads")
        .insert({
          company_id: driver.company_id,
          driver_id: driver.id,
          thread_type: "driver",
          title: `Driver SMS - ${driver.name || from}`,
          participants,
          unread_count: {},
        })
        .select("id, unread_count")
        .single()
      if (created.error || !created.data?.id) {
        Sentry.captureException(created.error || new Error("Failed to create chat thread"))
        return plainTwimlResponse("Unable to save message")
      }
      thread = created.data
    }

    const unreadCount = (thread.unread_count && typeof thread.unread_count === "object") ? { ...thread.unread_count } : {}
    for (const uid of participants) {
      if (uid === senderUserId) continue
      const current = Number((unreadCount as any)[uid] || 0)
      ;(unreadCount as any)[uid] = current + 1
    }

    const messageInsert = await supabase
      .from("chat_messages")
      .insert({
        thread_id: thread.id,
        company_id: driver.company_id,
        sender_id: senderUserId,
        message: body,
        message_type: "sms_inbound",
        attachments: [],
        is_read: false,
        read_by: [],
      })
      .select("id")
      .single()

    if (messageInsert.error) {
      Sentry.captureException(messageInsert.error)
      return plainTwimlResponse("Unable to save message")
    }

    await supabase
      .from("chat_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_by: senderUserId,
        unread_count: unreadCount,
      })
      .eq("id", thread.id)

    // Push unread reply signal to dispatcher notifications feed.
    if (dispatcherUserIds.length > 0) {
      const rows = dispatcherUserIds.map((uid) => ({
        user_id: uid,
        company_id: driver.company_id,
        type: "load_update",
        title: "New Driver SMS Reply",
        message: `${driver.name || "Driver"}: ${body.slice(0, 160)}`,
        priority: "high",
        read: false,
        metadata: {
          source: "twilio_inbound",
          driver_id: driver.id,
          thread_id: thread.id,
          message_sid: messageSid || null,
          from,
        },
      }))
      await supabase.from("notifications").insert(rows)
    }

    return plainTwimlResponse("Received")
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: "Failed to process inbound SMS" }, { status: 500 })
  }
}
