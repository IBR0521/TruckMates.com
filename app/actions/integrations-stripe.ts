"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Stripe Integration Backend
 * Processes payments for invoices
 */

// Get Stripe client (using environment variables or integration settings)
async function getStripeClient() {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ""
  
  if (!STRIPE_SECRET_KEY) {
    // Try to get from integration settings
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Not authenticated")
    }

    const result = await getCachedUserCompany(user.id)
    if (result.error || !result.company_id) {
      throw new Error("No company found")
    }

    const { data: integrations } = await supabase
      .from("company_integrations")
      .select("stripe_enabled, stripe_api_key")
      .eq("company_id", result.company_id)
      .single()

    if (!integrations?.stripe_enabled || !integrations.stripe_api_key) {
      throw new Error("Stripe integration is not enabled or configured")
    }

    // Dynamically import Stripe
    const stripe = (await import("stripe")).default
    return new stripe(integrations.stripe_api_key, {
      apiVersion: "2024-11-20.acacia",
    })
  }

  // Use environment variable
  const stripe = (await import("stripe")).default
  return new stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-11-20.acacia",
  })
}

/**
 * Create payment intent for invoice
 */
export async function createInvoicePayment(invoiceId: string, amount?: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("company_id", result.company_id)
    .single()

  if (invoiceError || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  if (invoice.status === "paid") {
    return { error: "Invoice is already paid", data: null }
  }

  try {
    const stripe = await getStripeClient()
    const paymentAmount = amount || invoice.amount

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentAmount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        company_id: result.company_id,
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
  } catch (error: any) {
    console.error("[Stripe] Payment creation error:", error)
    return { error: error?.message || "Failed to create payment", data: null }
  }
}

/**
 * Confirm payment and update invoice
 */
export async function confirmInvoicePayment(invoiceId: string, paymentIntentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    const stripe = await getStripeClient()

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
      .eq("company_id", result.company_id)

    if (updateError) {
      return { error: updateError.message, data: null }
    }

    revalidatePath("/dashboard/accounting/invoices")
    return { data: { success: true, payment_intent: paymentIntent }, error: null }
  } catch (error: any) {
    console.error("[Stripe] Payment confirmation error:", error)
    return { error: error?.message || "Failed to confirm payment", data: null }
  }
}

/**
 * Process PayPal payment for invoice
 */
export async function processPayPalInvoicePayment(invoiceId: string, amount?: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get integration settings
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("paypal_enabled, paypal_client_id")
    .eq("company_id", result.company_id)
    .single()

  if (!integrations?.paypal_enabled || !integrations.paypal_client_id) {
    return { error: "PayPal integration is not enabled or configured", data: null }
  }

  // Get invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("company_id", result.company_id)
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
    const approvalUrl = order.links?.find((link: any) => link.rel === "approve")?.href

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
  } catch (error: any) {
    console.error("[PayPal] Payment error:", error)
    return { error: error?.message || "Failed to process PayPal payment", data: null }
  }
}

/**
 * Capture PayPal payment
 */
export async function capturePayPalPayment(invoiceId: string, orderId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get integration settings
  const { data: integrations } = await supabase
    .from("company_integrations")
    .select("paypal_enabled, paypal_client_id")
    .eq("company_id", result.company_id)
    .single()

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
        .eq("company_id", result.company_id)

      revalidatePath("/dashboard/accounting/invoices")
      return { data: { success: true, capture }, error: null }
    }

    return { error: `Payment not completed. Status: ${capture.status}`, data: null }
  } catch (error: any) {
    console.error("[PayPal] Capture error:", error)
    return { error: error?.message || "Failed to capture PayPal payment", data: null }
  }
}







