import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ""
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ""
const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox"

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")
  const url = PAYPAL_MODE === "live" 
    ? "https://api-m.paypal.com/v1/oauth2/token"
    : "https://api-m.sandbox.paypal.com/v1/oauth2/token"

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token")
  }

  const data = await response.json()
  return data.access_token
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }
    const eventType = body.event_type

    // SECURITY: Verify webhook signature with PayPal
    const accessToken = await getPayPalAccessToken()
    const baseUrl = PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com"

    // BUG-006 FIX: Fail immediately if PAYPAL_WEBHOOK_ID is not set
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (!webhookId) {
      console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID not configured")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get signature headers
    const transmissionId = request.headers.get("paypal-transmission-id")
    const transmissionTime = request.headers.get("paypal-transmission-time")
    const certUrl = request.headers.get("paypal-cert-url")
    const authAlgo = request.headers.get("paypal-auth-algo")
    const transmissionSig = request.headers.get("paypal-transmission-sig")

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      console.error("[PayPal Webhook] Missing signature headers")
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    // Verify webhook signature with PayPal
    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: body,
      }),
    })

    if (!verifyResponse.ok) {
      console.error("[PayPal Webhook] Signature verification failed")
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    const verifyResult = await verifyResponse.json()
    if (verifyResult.verification_status !== "SUCCESS") {
      console.error("[PayPal Webhook] Signature verification failed:", verifyResult.verification_status)
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    // SECURITY: Use admin client for webhooks (no user session)
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const supabase = createAdminClient()

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.CREATED":
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subscriptionId = body.resource?.id
        if (!subscriptionId) break

        // Get subscription details
        const subResponse = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        })

        if (!subResponse.ok) break

        const subscription = await subResponse.json()
        const email = subscription.subscriber?.email_address

        if (!email) break

        // Find user by email
        const { data: userData } = await supabase
          .from("users")
          .select("company_id, id")
          .eq("email", email)
          .single()

        if (!userData?.company_id) break

        // BUG-020 FIX: Map PayPal plan_id to internal plan_id using metadata or mapping table
        // PayPal's plan_id is a PayPal-generated string, not our internal UUID
        // We should store our plan_id in subscription metadata when creating the subscription
        const paypalPlanId = subscription.plan_id // PayPal's internal plan ID (e.g., "P-7ML4271244454362WXNWU5NQ")
        const internalPlanId = subscription.custom_id || subscription.plan_id // Try custom_id first (where we store our plan_id)
        
        // If custom_id is not set, try to find plan by PayPal plan_id mapping
        // This requires a mapping table or storing plan_id in subscription metadata
        let finalPlanId = internalPlanId
        
        if (!internalPlanId || internalPlanId === paypalPlanId) {
          // BUG-020 FIX: Query for plan mapping or use default plan
          // For now, log error and use a default plan or fail
          console.error(`[PayPal Webhook] No internal plan_id found for PayPal plan ${paypalPlanId}. Subscription metadata should include plan_id when creating subscription.`)
          // Optionally: Query a plan_mappings table or use a default plan
          // For now, we'll fail gracefully
          return NextResponse.json({ 
            error: `Plan mapping not found for PayPal plan ${paypalPlanId}. Please ensure plan_id is stored in subscription metadata.` 
          }, { status: 400 })
        }

        // Update or create subscription in database
        await supabase.from("subscriptions").upsert({
          company_id: userData.company_id,
          plan_id: finalPlanId, // BUG-020 FIX: Use mapped internal plan_id, not PayPal's plan_id
          status: "trialing",
          paypal_subscription_id: subscriptionId,
          current_period_start: new Date().toISOString(),
          trial_end: subscription.billing_info?.next_billing_time
            ? new Date(subscription.billing_info.next_billing_time).toISOString()
            : null,
        }, {
          onConflict: "company_id",
        })

        break
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subscriptionId = body.resource?.id
        if (!subscriptionId) break

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("paypal_subscription_id", subscriptionId)

        break
      }

      case "PAYMENT.SALE.COMPLETED": {
        // Payment received
        const sale = body.resource
        const subscriptionId = sale.billing_agreement_id

        if (subscriptionId) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
            })
            .eq("paypal_subscription_id", subscriptionId)
        }

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error("PayPal webhook error:", error)
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

