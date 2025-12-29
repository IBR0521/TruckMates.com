"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Start free trial without payment (for now)
export async function startFreeTrial(planId: string) {
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
      .select("company_id, email, full_name")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    // Check if company already has a subscription
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("company_id", userData.company_id)
      .single()

    if (existingSubscription) {
      // If already has active subscription or trial, return error
      if (existingSubscription.status === "active" || existingSubscription.status === "trialing") {
        return { error: "You already have an active subscription or trial", data: null }
      }
    }

    // Get plan details - handle if table doesn't exist
    let plan: any = null
    const { data: planData, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("name", planId) // Match by name instead of id
      .single()

    if (planError) {
      // Table might not exist yet - use hardcoded plans as fallback
      if (planError.code === "42P01" || planError.message.includes("does not exist")) {
        console.warn("[TRIAL] subscription_plans table not found, using hardcoded plans")
        // Hardcoded plan data as fallback
        const hardcodedPlans: Record<string, any> = {
          starter: {
            id: "starter",
            name: "starter",
            display_name: "Starter",
            price_monthly: 29,
            max_users: 10,
            max_drivers: 15,
            max_vehicles: 10,
            features: ["basic"],
          },
          professional: {
            id: "professional",
            name: "professional",
            display_name: "Professional",
            price_monthly: 59,
            max_users: 25,
            max_drivers: 40,
            max_vehicles: 30,
            features: ["basic", "eld", "advanced"],
          },
          enterprise: {
            id: "enterprise",
            name: "enterprise",
            display_name: "Enterprise",
            price_monthly: 99,
            max_users: null,
            max_drivers: null,
            max_vehicles: null,
            features: ["basic", "eld", "advanced", "enterprise"],
          },
        }
        plan = hardcodedPlans[planId]
        if (!plan) {
          return { error: "Plan not found", data: null }
        }
      } else {
        return { error: planError.message || "Plan not found", data: null }
      }
    } else {
      plan = planData
    }

    if (!plan) {
      return { error: "Plan not found", data: null }
    }

    // Calculate trial dates
    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 7) // 7 days from now

    // Create subscription with trial status
    const subscriptionData = {
      company_id: userData.company_id,
      plan_id: plan.id, // Use plan.id from database or hardcoded
      status: "trialing",
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      cancel_at_period_end: false,
    }

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .upsert(subscriptionData, {
        onConflict: "company_id",
      })
      .select()
      .single()

    if (subError) {
      console.error("Error creating subscription:", subError)
      return { error: subError.message || "Failed to start trial", data: null }
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/settings")

    return { data: subscription, error: null }
  } catch (error: any) {
    console.error("Error starting free trial:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

// Check if trial is ending soon (within 2 days)
export async function checkTrialEndingSoon() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { endingSoon: false, daysLeft: 0, error: null }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return { endingSoon: false, daysLeft: 0, error: null }
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("trial_end, status")
      .eq("company_id", userData.company_id)
      .eq("status", "trialing")
      .single()

    if (!subscription?.trial_end) {
      return { endingSoon: false, daysLeft: 0, error: null }
    }

    const trialEnd = new Date(subscription.trial_end)
    const now = new Date()
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      endingSoon: daysLeft <= 2 && daysLeft > 0,
      daysLeft: daysLeft > 0 ? daysLeft : 0,
      trialEnd: subscription.trial_end,
      error: null,
    }
  } catch (error: any) {
    return { endingSoon: false, daysLeft: 0, error: error?.message }
  }
}

