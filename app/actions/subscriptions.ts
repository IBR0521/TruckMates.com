"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import Stripe from "stripe"

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return null // Return null instead of throwing error
  }
  try {
    return new Stripe(secretKey, {
      apiVersion: "2024-12-18.acacia",
    })
  } catch (error) {
    return null
  }
}

// Get subscription plans from database
export async function getSubscriptionPlans() {
  try {
    const supabase = await createClient()

    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true })

    if (error) {
      // Table might not exist yet - return empty array instead of error
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return { data: [], error: null }
      }
      return { error: error.message, data: null }
    }

    return { data: plans || [], error: null }
  } catch (error: any) {
    // Handle any unexpected errors gracefully
    return { data: [], error: null }
  }
}

// Get current company's subscription
export async function getCurrentSubscription() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    // Check if subscriptions table exists before querying
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select(`
        *,
        subscription_plans:plan_id (
          id,
          name,
          display_name,
          price_monthly,
          max_users,
          max_drivers,
          features
        )
      `)
      .eq("company_id", userData.company_id)
      .single()

    if (error) {
      // Table might not exist yet - return null instead of error
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return { data: null, error: null }
      }
      // PGRST116 = no rows returned, which is OK for new companies
      if (error.code === "PGRST116") {
        return { data: null, error: null }
      }
      return { error: error.message, data: null }
    }

    return { data: subscription || null, error: null }
  } catch (error: any) {
    // Handle any unexpected errors gracefully
    return { data: null, error: null }
  }
}

// Create Stripe checkout session with 7-day free trial
export async function createCheckoutSession(planId: string) {
  const stripe = getStripe()
  if (!stripe) {
    return { error: "Payment processing is not configured. Please contact support.", data: null }
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
    // Table might not exist yet
    if (planError.code === "42P01" || planError.message.includes("does not exist")) {
      return { error: "Subscription plans are not set up yet. Please contact support.", data: null }
    }
    return { error: planError.message || "Plan not found", data: null }
  }

  if (!plan) {
    return { error: "Plan not found", data: null }
  }

  // Check if Stripe price ID exists, if not create it
  let stripePriceId = plan.stripe_price_id_monthly

  if (!stripePriceId) {
    // Create Stripe price if it doesn't exist
    try {
      const stripe = getStripe()
      if (!stripe) {
        return { error: "Payment processing is not configured. Please contact support.", data: null }
      }
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: Math.round(plan.price_monthly * 100), // Convert to cents
        recurring: {
          interval: "month",
        },
        product_data: {
          name: `${plan.display_name} Plan`,
          description: plan.description || `Subscription to ${plan.display_name} plan`,
        },
      })

      stripePriceId = price.id

      // Update plan with Stripe price ID
      await supabase
        .from("subscription_plans")
        .update({ stripe_price_id_monthly: stripePriceId })
        .eq("id", planId)
    } catch (error: any) {
      return { error: `Failed to create Stripe price: ${error.message}`, data: null }
    }
  }

  // Get or create Stripe customer
  let stripeCustomerId: string | null = null

  // Check if company already has a Stripe customer ID
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", userData.company_id)
    .single()

  if (existingSubscription?.stripe_customer_id) {
    stripeCustomerId = existingSubscription.stripe_customer_id
  } else {
    // Create new Stripe customer
    try {
      const stripe = getStripe()
      if (!stripe) {
        return { error: "Payment processing is not configured. Please contact support.", data: null }
      }
      const customer = await stripe.customers.create({
        email: userData.email || user.email || undefined,
        name: userData.full_name || undefined,
        metadata: {
          company_id: userData.company_id,
          user_id: user.id,
        },
      })
      stripeCustomerId = customer.id
    } catch (error: any) {
      return { error: `Failed to create Stripe customer: ${error.message}`, data: null }
    }
  }

  // Create checkout session with 7-day free trial
  try {
    const stripe = getStripe()
    if (!stripe) {
      return { error: "Payment processing is not configured. Please contact support.", data: null }
    }
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        metadata: {
          company_id: userData.company_id,
          plan_id: planId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/plans?canceled=true`,
      metadata: {
        company_id: userData.company_id,
        plan_id: planId,
        user_id: user.id,
      },
    })

    return { data: { sessionId: session.id, url: session.url }, error: null }
  } catch (error: any) {
    return { error: `Failed to create checkout session: ${error.message}`, data: null }
  }
}

// Cancel subscription
export async function cancelSubscription() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can cancel subscriptions", data: null }
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("company_id", userData.company_id)
    .single()

  if (subError || !subscription?.stripe_subscription_id) {
    return { error: "No active subscription found", data: null }
  }

  try {
    const stripe = getStripe()
    if (!stripe) {
      return { error: "Payment processing is not configured. Please contact support.", data: null }
    }
    // Cancel at period end (allows access until end of billing period)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Update subscription in database
    await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      })
      .eq("company_id", userData.company_id)

    revalidatePath("/dashboard/settings")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: `Failed to cancel subscription: ${error.message}`, data: null }
  }
}

// Reactivate subscription
export async function reactivateSubscription() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can reactivate subscriptions", data: null }
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("company_id", userData.company_id)
    .single()

  if (subError || !subscription?.stripe_subscription_id) {
    return { error: "No subscription found", data: null }
  }

  try {
    const stripe = getStripe()
    if (!stripe) {
      return { error: "Payment processing is not configured. Please contact support.", data: null }
    }
    // Remove cancellation
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    // Update subscription in database
    await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
      })
      .eq("company_id", userData.company_id)

    revalidatePath("/dashboard/settings")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: `Failed to reactivate subscription: ${error.message}`, data: null }
  }
}

// Get billing history (invoices)
export async function getBillingHistory() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      // Table might not exist yet - return empty array instead of error
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return { data: [], error: null }
      }
      return { error: error.message, data: null }
    }

    return { data: invoices || [], error: null }
  } catch (error: any) {
    // Handle any unexpected errors gracefully
    return { data: [], error: null }
  }
}

// Check subscription limits
export async function checkSubscriptionLimits() {
  const subscriptionResult = await getCurrentSubscription()

  if (subscriptionResult.error || !subscriptionResult.data) {
    return {
      error: subscriptionResult.error || "No subscription found",
      data: null,
      limits: {
        maxUsers: 0,
        maxDrivers: 0,
        maxVehicles: 0,
        canUseELD: false,
        planName: "",
        planDisplayName: "",
      },
    }
  }

  const subscription = subscriptionResult.data
  const plan = subscription.subscription_plans

  // Check if subscription is active or in trial
  const isActive = subscription.status === "active" || subscription.status === "trialing"

  if (!isActive) {
    return {
      error: "Subscription is not active",
      data: null,
      limits: {
        maxUsers: 0,
        maxDrivers: 0,
        maxVehicles: 0,
        canUseELD: false,
        planName: "",
        planDisplayName: "",
      },
    }
  }

  return {
    data: subscription,
    error: null,
    limits: {
      maxUsers: plan?.max_users || null, // null = unlimited
      maxDrivers: plan?.max_drivers || null, // null = unlimited
      maxVehicles: plan?.max_vehicles || null, // null = unlimited
      canUseELD: plan?.name === "professional" || plan?.name === "enterprise",
      planName: plan?.name || "",
      planDisplayName: plan?.display_name || "",
    },
  }
}

