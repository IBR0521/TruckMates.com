import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return null // Return null instead of throwing - webhook will handle it
  }
  try {
    return new Stripe(secretKey, {
      apiVersion: "2024-12-18.acacia",
    })
  } catch (error) {
    return null
  }
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(supabase, invoice)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Webhook handler error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const companyId = session.metadata?.company_id
  const planId = session.metadata?.plan_id

  if (!companyId || !planId) {
    console.error("Missing metadata in checkout session")
    return
  }

  // Subscription will be created by subscription.created webhook
  // This just confirms the checkout was completed
  console.log(`Checkout completed for company ${companyId}, plan ${planId}`)
}

async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.company_id
  const planId = subscription.metadata?.plan_id

  if (!companyId || !planId) {
    console.error("Missing metadata in subscription")
    return
  }

  // Determine subscription status
  let status = "active"
  if (subscription.status === "trialing") {
    status = "trialing"
  } else if (subscription.status === "past_due") {
    status = "past_due"
  } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
    status = "canceled"
  }

  // Get plan details
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("id", planId)
    .single()

  if (!plan) {
    console.error(`Plan ${planId} not found`)
    return
  }

  // Upsert subscription
  const subscriptionData = {
    company_id: companyId,
    plan_id: planId,
    status: status,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: subscription.items.data[0]?.price.id,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
  }

  const { error } = await supabase.from("subscriptions").upsert(subscriptionData, {
    onConflict: "company_id",
  })

  if (error) {
    console.error("Error upserting subscription:", error)
    throw error
  }

  console.log(`Subscription updated for company ${companyId}`)
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.company_id

  if (!companyId) {
    console.error("Missing company_id in subscription metadata")
    return
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)

  if (error) {
    console.error("Error updating subscription:", error)
    throw error
  }

  console.log(`Subscription canceled for company ${companyId}`)
}

async function handleInvoicePaid(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return
  }

  // Get subscription to find company_id
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("company_id, id")
    .eq("stripe_subscription_id", subscriptionId)
    .single()

  if (!subscription) {
    console.error(`Subscription ${subscriptionId} not found`)
    return
  }

  // Store invoice
  const invoiceData = {
    company_id: subscription.company_id,
    subscription_id: subscription.id,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_paid / 100, // Convert from cents
    currency: invoice.currency,
    status: invoice.status === "paid" ? "paid" : "open",
    invoice_pdf: invoice.invoice_pdf,
    hosted_invoice_url: invoice.hosted_invoice_url,
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    paid_at: invoice.status === "paid" ? new Date().toISOString() : null,
  }

  const { error } = await supabase.from("invoices").upsert(invoiceData, {
    onConflict: "stripe_invoice_id",
  })

  if (error) {
    console.error("Error storing invoice:", error)
    throw error
  }

  console.log(`Invoice ${invoice.id} stored for company ${subscription.company_id}`)
}

async function handleInvoicePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return
  }

  // Update subscription status to past_due
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId)

  if (error) {
    console.error("Error updating subscription status:", error)
    throw error
  }

  console.log(`Payment failed for subscription ${subscriptionId}`)
}

