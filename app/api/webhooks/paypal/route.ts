import { NextRequest, NextResponse } from "next/server"
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
    const body = await request.json()
    const eventType = body.event_type

    // Verify webhook (in production, verify with PayPal)
    const accessToken = await getPayPalAccessToken()
    const baseUrl = PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com"

    // Verify webhook signature (simplified - in production use proper verification)
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || ""

    const supabase = await createClient()

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

        // Get plan from subscription (you'll need to store plan_id when creating subscription)
        // For now, we'll need to get it from metadata or subscription details
        const planName = subscription.plan_id // You'll need to map this to your plan_id

        // Update or create subscription in database
        await supabase.from("subscriptions").upsert({
          company_id: userData.company_id,
          plan_id: planName, // You'll need to map PayPal plan to your plan_id
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
  } catch (error: any) {
    console.error("PayPal webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

