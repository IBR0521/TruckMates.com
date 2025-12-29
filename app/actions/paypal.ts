"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// PayPal API configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ""
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ""
const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox" // 'sandbox' or 'live'

// Get PayPal access token
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

// Create PayPal subscription with 7-day free trial
export async function createPayPalSubscription(planId: string) {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return { error: "PayPal is not configured. Please contact support.", data: null }
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id, email, full_name")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single()

    if (planError) {
      if (planError.code === "42P01" || planError.message.includes("does not exist")) {
        return { error: "Subscription plans are not set up yet. Please contact support.", data: null }
      }
      return { error: planError.message || "Plan not found", data: null }
    }

    if (!plan) {
      return { error: "Plan not found", data: null }
    }

    const accessToken = await getPayPalAccessToken()
    const baseUrl = PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com"

    // Create PayPal product
    const productResponse = await fetch(`${baseUrl}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        name: `${plan.display_name} Plan`,
        description: plan.description || `Subscription to ${plan.display_name} plan`,
        type: "SERVICE",
      }),
    })

    if (!productResponse.ok) {
      const errorData = await productResponse.json()
      console.error("PayPal product creation error:", errorData)
      return { error: "Failed to create PayPal product", data: null }
    }

    const product = await productResponse.json()

    // Create PayPal plan (billing plan)
    const planResponse = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        product_id: product.id,
        name: `${plan.display_name} Plan`,
        description: plan.description || `Monthly subscription to ${plan.display_name} plan`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "TRIAL",
            sequence: 1,
            total_cycles: 1,
            pricing_scheme: {
              fixed_price: {
                value: "0",
                currency_code: "USD",
              },
            },
          },
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 2,
            total_cycles: 0, // Infinite
            pricing_scheme: {
              fixed_price: {
                value: plan.price_monthly.toString(),
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "USD",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    })

    if (!planResponse.ok) {
      const errorData = await planResponse.json()
      console.error("PayPal plan creation error:", errorData)
      return { error: "Failed to create PayPal billing plan", data: null }
    }

    const paypalPlan = await planResponse.json()

    // Create subscription
    const subscriptionResponse = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        plan_id: paypalPlan.id,
        subscriber: {
          email_address: userData.email || user.email || undefined,
          name: {
            given_name: userData.full_name?.split(" ")[0] || "Customer",
            surname: userData.full_name?.split(" ").slice(1).join(" ") || "",
          },
        },
        application_context: {
          brand_name: "TruckMates Logistics",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?subscription=success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/plans?canceled=true`,
        },
      }),
    })

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.json()
      console.error("PayPal subscription creation error:", errorData)
      return { error: "Failed to create PayPal subscription", data: null }
    }

    const subscription = await subscriptionResponse.json()

    // Find approval link
    const approvalLink = subscription.links?.find((link: any) => link.rel === "approve")?.href

    if (!approvalLink) {
      return { error: "Failed to get PayPal approval URL", data: null }
    }

    return { data: { url: approvalLink, subscriptionId: subscription.id }, error: null }
  } catch (error: any) {
    console.error("PayPal subscription error:", error)
    return { error: error?.message || "Failed to create PayPal subscription", data: null }
  }
}

// Verify PayPal subscription after approval
export async function verifyPayPalSubscription(subscriptionId: string) {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return { error: "PayPal is not configured", data: null }
    }

    const accessToken = await getPayPalAccessToken()
    const baseUrl = PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com"

    const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      return { error: "Failed to verify PayPal subscription", data: null }
    }

    const subscription = await response.json()

    return { data: subscription, error: null }
  } catch (error: any) {
    console.error("PayPal verification error:", error)
    return { error: error?.message || "Failed to verify PayPal subscription", data: null }
  }
}

