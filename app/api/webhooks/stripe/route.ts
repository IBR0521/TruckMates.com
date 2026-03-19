import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return null // Return null instead of throwing - webhook will handle it
  }
  try {
    return new Stripe(secretKey, {
      // Use the same stable public API version as server-side Stripe client
      apiVersion: "2025-11-17.clover",
    })
  } catch (error) {
    return null
  }
}

// EXT-003 FIX: Don't default to empty string - return 503 if not configured
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  // EXT-003: Check webhook secret before processing
  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  // Use service-role Supabase client for webhook writes (no user session / bypass RLS)
  const supabase = createAdminClient()

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
    // BUG-021 FIX: Use proper Stripe API version and type-safe access to period fields
    // Stripe Subscription object has current_period_start and current_period_end as numbers (Unix timestamps)
    // These fields exist on the Subscription type but may not be exposed in older SDK versions
    // Access via type assertion with proper validation
    current_period_start: (subscription as any).current_period_start 
      ? new Date((subscription as any).current_period_start * 1000).toISOString()
      : new Date().toISOString(),
    current_period_end: (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString()
      : new Date().toISOString(),
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
  const subscriptionId = (invoice as any).subscription as string

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

  // Store invoice in separate billing_invoices table (not freight invoices table)
  // Check if billing_invoices table exists, if not create it or use alternative storage
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

  // Try to insert into billing_invoices table first
  let { error } = await supabase.from("billing_invoices").upsert(invoiceData, {
    onConflict: "stripe_invoice_id",
  })

  // If billing_invoices table doesn't exist, log error but don't fail
  // The table should be created via migration
  if (error && error.message?.includes("does not exist")) {
    console.error("[Stripe Webhook] billing_invoices table does not exist. Please run migration to create it.")
    console.error("[Stripe Webhook] NOT storing invoice in freight invoices table to prevent data corruption.")
    // Don't store in invoices table - this would corrupt TMS accounting data
    return
  }

  if (error) {
    console.error("Error storing invoice:", error)
    throw error
  }

  console.log(`Invoice ${invoice.id} stored for company ${subscription.company_id}`)
}

async function handleInvoicePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string

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

