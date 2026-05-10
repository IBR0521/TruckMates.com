import { NextRequest, NextResponse } from "next/server"
import { Paddle, Environment } from "@paddle/paddle-node-sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePlanTier, type PlanTier } from "@/lib/plan-limits"

function paddleSdk(): Paddle | null {
  const apiKey = String(process.env.PADDLE_API_KEY || "").trim()
  if (!apiKey) return null
  const env =
    String(process.env.PADDLE_ENVIRONMENT || "sandbox").toLowerCase() === "production"
      ? Environment.production
      : Environment.sandbox
  return new Paddle(apiKey, { environment: env })
}

function tierFromPayload(data: Record<string, unknown>): PlanTier | null {
  const custom = data.customData as Record<string, unknown> | undefined
  const fromCustom = custom?.target_tier ?? custom?.subscription_tier
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
      const subId = String(data.id ?? "")
      const customerId = typeof data.customerId === "string" ? data.customerId : null
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
        if (eventType === "subscription.canceled") {
          patch.subscription_status = "canceled"
          const billingPeriod = data.currentBillingPeriod as { endsAt?: string } | undefined
          const periodEnd = billingPeriod?.endsAt
          if (typeof periodEnd === "string") patch.subscription_ends_at = periodEnd
        } else if (tier) {
          patch.subscription_tier = tier
          patch.subscription_status = "active"
        } else if (eventType === "subscription.created" || eventType === "subscription.updated") {
          patch.subscription_status = "active"
        }
        if (Object.keys(patch).length > 0) {
          await admin.from("companies").update(patch as never).eq("id", companyId)
        }
      }
    }

    if (eventType === "transaction.completed") {
      const cid = (data.customData as Record<string, unknown> | undefined)?.company_id
      const companyId = typeof cid === "string" ? cid : null
      const amount =
        typeof data.details === "object" && data.details !== null
          ? Number((data.details as { totals?: { total?: string } }).totals?.total || 0)
          : Number((data as { amount?: string }).amount || 0)
      const txId = String(data.id || "")
      if (companyId && txId) {
        const paymentDate = new Date().toISOString().slice(0, 10)
        await admin.from("company_payment_history").insert({
          company_id: companyId,
          amount: amount || 0,
          currency: "USD",
          payment_method: "card",
          transaction_id: txId,
          status: "completed",
          payment_date: paymentDate,
          processed_at: new Date().toISOString(),
          metadata: { source: "paddle_webhook", event_type: eventType },
        } as never)
      }
    }

    if (eventType === "transaction.payment_failed") {
      const cid = (data.customData as Record<string, unknown> | undefined)?.company_id
      const companyId = typeof cid === "string" ? cid : null
      if (companyId) {
        await admin.from("companies").update({ subscription_status: "past_due" } as never).eq("id", companyId)
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
