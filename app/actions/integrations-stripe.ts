"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"

/**
 * Stripe Integration Backend
 * Processes payments for invoices
 */

const STRIPE_DISABLED_MESSAGE = "Stripe integration is disabled. Billing is handled through Paddle."

// Get Stripe client (using environment variables or integration settings)
async function getStripeClient(): Promise<{ stripe: import("stripe").default; error: null } | { stripe: null; error: string }> {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ""
  const Stripe = (await import("stripe")).default

  if (!STRIPE_SECRET_KEY) {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { stripe: null, error: ctx.error || "Not authenticated" }
    }

    const { data: integrations, error: integrationsError } = await supabase
      .from("company_integrations")
      .select("stripe_enabled, stripe_api_key")
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (integrationsError) {
      return { stripe: null, error: integrationsError.message }
    }

    if (!integrations?.stripe_enabled || !integrations.stripe_api_key) {
      return { stripe: null, error: STRIPE_DISABLED_MESSAGE }
    }

    return { stripe: new Stripe(integrations.stripe_api_key), error: null }
  }

  return { stripe: new Stripe(STRIPE_SECRET_KEY), error: null }
}

/**
 * Create payment intent for invoice
 */
export async function createInvoicePayment(invoiceId: string, amount?: number) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, amount, status, stripe_payment_intent_id, paypal_order_id, paypal_capture_id, paid_date, payment_method",
    )
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .single()

  if (invoiceError || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  if (invoice.status === "paid") {
    return { error: "Invoice is already paid", data: null }
  }

  try {
    const { stripe, error: stripeInitError } = await getStripeClient()
    if (!stripe) {
      return { data: null, error: stripeInitError || STRIPE_DISABLED_MESSAGE }
    }
    const paymentAmount = amount || invoice.amount

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentAmount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        company_id: ctx.companyId,
      },
      description: `Payment for invoice ${invoice.invoice_number}`,
    })

    // Store payment intent ID
    await supabase
      .from("invoices")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", invoiceId)

    return {
      data: {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create payment"), data: null }
  }
}

/**
 * Confirm payment and update invoice
 */
export async function confirmInvoicePayment(invoiceId: string, paymentIntentId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { stripe, error: stripeInitError } = await getStripeClient()
    if (!stripe) {
      return { data: null, error: stripeInitError || STRIPE_DISABLED_MESSAGE }
    }

    // Retrieve payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== "succeeded") {
      return { error: `Payment not completed. Status: ${paymentIntent.status}`, data: null }
    }

    // Update invoice
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_date: new Date().toISOString().split("T")[0],
        payment_method: "stripe",
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", invoiceId)
      .eq("company_id", ctx.companyId)

    if (updateError) {
      return { error: updateError.message, data: null }
    }

    try {
      const { sendPushToCompanyRoles } = await import("./push-notifications")
      await sendPushToCompanyRoles(
        ctx.companyId,
        ["super_admin", "operations_manager", "financial_controller"],
        {
          title: "Invoice payment received",
          body: `Invoice ${invoiceId} was paid via Stripe`,
          data: {
            type: "invoice_paid",
            invoiceId: String(invoiceId),
            link: `/dashboard/accounting/invoices/${invoiceId}`,
          },
        },
      )
    } catch (pushError) {
      Sentry.captureException(pushError)
    }

    revalidatePath("/dashboard/accounting/invoices")
    return { data: { success: true, payment_intent: paymentIntent }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to confirm payment"), data: null }
  }
}

/**
 * Process PayPal payment for invoice
 */
export async function processPayPalInvoicePayment(invoiceId: string, amount?: number) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get integration settings
  const { data: integrations, error: integrationsError } = await supabase
    .from("company_integrations")
    .select("paypal_enabled, paypal_client_id")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (integrationsError) {
    return { error: integrationsError.message, data: null }
  }

  if (!integrations?.paypal_enabled || !integrations.paypal_client_id) {
    return { error: "PayPal integration is not enabled or configured", data: null }
  }

  // Get invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, amount, status, stripe_payment_intent_id, paypal_order_id, paypal_capture_id, paid_date, payment_method",
    )
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .single()

  if (invoiceError || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  if (invoice.status === "paid") {
    return { error: "Invoice is already paid", data: null }
  }

  try {
    const PAYPAL_CLIENT_ID = integrations.paypal_client_id
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ""
    const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox"

    // Get access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")
    const baseUrl = PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"

    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    if (!tokenResponse.ok) {
      return { error: "Failed to authenticate with PayPal", data: null }
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    const paymentAmount = amount || invoice.amount

    // Create PayPal order
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: invoice.invoice_number,
            description: `Payment for invoice ${invoice.invoice_number}`,
            amount: {
              currency_code: "USD",
              value: paymentAmount.toFixed(2),
            },
            invoice_id: invoice.invoice_number,
          },
        ],
        application_context: {
          brand_name: "TruckMates",
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/accounting/invoices/${invoiceId}?payment=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/accounting/invoices/${invoiceId}?payment=canceled`,
        },
      }),
    })

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json()
      return { error: `PayPal order creation failed: ${errorData.message || "Unknown error"}`, data: null }
    }

    const order = await orderResponse.json()
    const approvalUrl = order.links?.find((link: { rel?: string; href?: string }) => link.rel === "approve")?.href

    // Store order ID
    await supabase
      .from("invoices")
      .update({
        paypal_order_id: order.id,
      })
      .eq("id", invoiceId)

    return {
      data: {
        order_id: order.id,
        approval_url: approvalUrl,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to process PayPal payment"), data: null }
  }
}

/**
 * Capture PayPal payment
 */
export async function capturePayPalPayment(invoiceId: string, orderId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get integration settings
  const { data: integrations, error: integrationsError } = await supabase
    .from("company_integrations")
    .select("paypal_enabled, paypal_client_id")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (integrationsError) {
    return { error: integrationsError.message, data: null }
  }

  if (!integrations?.paypal_enabled || !integrations.paypal_client_id) {
    return { error: "PayPal integration is not enabled", data: null }
  }

  try {
    const PAYPAL_CLIENT_ID = integrations.paypal_client_id
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ""
    const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox"

    // Get access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")
    const baseUrl = PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"

    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    if (!tokenResponse.ok) {
      return { error: "Failed to authenticate with PayPal", data: null }
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Capture order
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json()
      return { error: `PayPal capture failed: ${errorData.message || "Unknown error"}`, data: null }
    }

    const capture = await captureResponse.json()

    if (capture.status === "COMPLETED") {
      // Update invoice
      await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_method: "paypal",
          paypal_order_id: orderId,
          paypal_capture_id: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        })
        .eq("id", invoiceId)
        .eq("company_id", ctx.companyId)

      try {
        const { sendPushToCompanyRoles } = await import("./push-notifications")
        await sendPushToCompanyRoles(
          ctx.companyId,
          ["super_admin", "operations_manager", "financial_controller"],
          {
            title: "Invoice payment received",
            body: `Invoice ${invoiceId} was paid via PayPal`,
            data: {
              type: "invoice_paid",
              invoiceId: String(invoiceId),
              link: `/dashboard/accounting/invoices/${invoiceId}`,
            },
          },
        )
      } catch (pushError) {
        Sentry.captureException(pushError)
      }

      revalidatePath("/dashboard/accounting/invoices")
      return { data: { success: true, capture }, error: null }
    }

    return { error: `Payment not completed. Status: ${capture.status}`, data: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to capture PayPal payment"), data: null }
  }
}












