import { NextRequest, NextResponse } from "next/server"
import { Paddle, Environment } from "@paddle/paddle-node-sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import * as Sentry from "@sentry/nextjs"

function paddleSdk(): Paddle | null {
  const apiKey = String(process.env.PADDLE_API_KEY || "").trim()
  if (!apiKey) return null
  const env =
    String(process.env.PADDLE_ENVIRONMENT || "sandbox").toLowerCase() === "production"
      ? Environment.production
      : Environment.sandbox
  return new Paddle(apiKey, { environment: env })
}

/** Paddle may send camelCase or snake_case on webhook entities. */
function readCustomData(data: Record<string, unknown>): Record<string, unknown> | undefined {
  const raw = data.customData ?? data.custom_data
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return undefined
}

function getStringField(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

function tierFromPayload(data: Record<string, unknown>): PlanTier | null {
  const custom = readCustomData(data)
  const fromCustom =
    custom?.target_tier ??
    custom?.subscription_tier ??
    (typeof custom?.targetTier === "string" ? custom.targetTier : undefined)
  if (typeof fromCustom === "string" && fromCustom.trim()) {
    return normalizePlanTier(fromCustom)
  }
  return null
}

export async function POST(req: NextRequest) {
  const secret = String(process.env.PADDLE_WEBHOOK_SECRET || "").trim()
  const paddle = paddleSdk()
  if (!secret || !paddle) {
    return NextResponse.json({ error: "Paddle webhook not configured" }, { status: 500 })
  }

  const signature =
    req.headers.get("paddle-signature") || req.headers.get("Paddle-Signature") || ""
  const rawBody = await req.text()

  type PaddleWebhookEvent = { eventType?: string; data?: Record<string, unknown> }
  let event: PaddleWebhookEvent
  try {
    const unmarshaled = await paddle.webhooks.unmarshal(rawBody, secret, signature)
    event = unmarshaled as unknown as PaddleWebhookEvent
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  const eventType = String(event.eventType || "")
  const data = (event.data || {}) as Record<string, unknown>
  const admin = createAdminClient()

  try {
    if (eventType.startsWith("subscription.")) {
      const subId = String(getStringField(data, "id", "subscription_id") ?? "")
      const customerId = getStringField(data, "customerId", "customer_id")
      const companyRow = customerId
        ? await admin
            .from("companies")
            .select("id")
            .eq("paddle_customer_id", customerId)
            .maybeSingle()
        : { data: null }
      const companyId = (companyRow.data as { id?: string } | null)?.id
      const tier = tierFromPayload(data)

      if (companyId) {
        const patch: Record<string, unknown> = {}
        if (subId) patch.paddle_subscription_id = subId
        if (customerId) patch.paddle_customer_id = customerId
        if (eventType === "subscription.canceled" || eventType === "subscription.cancelled") {
          patch.subscription_status = "canceled"
          const billingPeriod = (data.currentBillingPeriod ?? data.current_billing_period) as
            | { endsAt?: string; ends_at?: string }
            | undefined
          const periodEnd = billingPeriod?.endsAt ?? billingPeriod?.ends_at
          if (typeof periodEnd === "string") patch.subscription_ends_at = periodEnd
        } else if (tier) {
          patch.subscription_tier = tier
          patch.subscription_status = "active"
        } else if (eventType === "subscription.created" || eventType === "subscription.updated") {
          patch.subscription_status = "active"
        }
        if (Object.keys(patch).length > 0) {
          const { error: upErr } = await admin.from("companies").update(patch).eq("id", companyId)
          if (upErr) {
            Sentry.captureMessage(`[paddle webhook] company update failed: ${upErr.message}`, {
              level: "error",
              extra: { companyId, eventType },
            })
          }
        }
      }
    }

    if (eventType === "transaction.completed") {
      const custom = readCustomData(data)
      const companyIdRaw = custom?.company_id ?? custom?.companyId
      const companyId = typeof companyIdRaw === "string" ? companyIdRaw.trim() : null
      const details = data.details && typeof data.details === "object" ? (data.details as Record<string, unknown>) : null
      const totals = details?.totals && typeof details.totals === "object" ? (details.totals as Record<string, unknown>) : null
      const amount =
        Number(totals?.total ?? totals?.grand_total ?? data.grand_total ?? data.amount ?? data.total) || 0
      const txId = String(getStringField(data, "id", "transaction_id") ?? "")
      if (companyId && txId) {
        const paymentDate = new Date().toISOString().slice(0, 10)
        const { error: payInsErr } = await admin.from("company_payment_history").insert({
          company_id: companyId,
          amount: amount || 0,
          currency: "USD",
          payment_method: "card",
          transaction_id: txId,
          status: "completed",
          payment_date: paymentDate,
          processed_at: new Date().toISOString(),
          metadata: { source: "paddle_webhook", event_type: eventType },
        })
        if (payInsErr) {
          Sentry.captureException(payInsErr, { tags: { cron: "paddle-webhook" }, extra: { companyId, txId } })
        }
      }
    }

    if (eventType === "transaction.payment_failed") {
      const custom = readCustomData(data)
      const companyIdRaw = custom?.company_id ?? custom?.companyId
      const companyId = typeof companyIdRaw === "string" ? companyIdRaw.trim() : null
      if (companyId) {
        const { error: pdErr } = await admin
          .from("companies")
          .update({ subscription_status: "past_due" })
          .eq("id", companyId)
        if (pdErr) {
          Sentry.captureMessage(`[paddle webhook] past_due update failed: ${pdErr.message}`, {
            level: "warning",
            extra: { companyId },
          })
        }
      }
      try {
        const { sendPushToCompanyRoles } = await import("@/app/actions/push-notifications")
        if (companyId) {
          await sendPushToCompanyRoles(companyId, ["super_admin", "financial_controller"], {
            title: "Payment failed",
            body: "We could not process your Paddle subscription payment. Update billing to avoid interruption.",
            data: { type: "billing_payment_failed" },
          })
        }
      } catch {
        // non-fatal
      }
    }
  } catch (e: unknown) {
    console.error("[paddle webhook]", e)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
