"use server"

import { checkSubscriptionLimits } from "./subscriptions"
import { createClient } from "@/lib/supabase/server"

// Check if company can add more users
export async function canAddUser() {
  try {
    const limitsResult = await checkSubscriptionLimits()

    if (limitsResult.error || !limitsResult.limits) {
      // If no subscription, don't allow (require subscription)
      return { allowed: false, error: "No active subscription. Please subscribe to a plan first." }
    }

  const { maxUsers } = limitsResult.limits

  // Unlimited
  if (maxUsers === null) {
    return { allowed: true, error: null }
  }

  // Get current user count
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, error: "Not authenticated" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { allowed: false, error: "No company found" }
  }

  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("company_id", userData.company_id)

  const currentUsers = count || 0

  if (currentUsers >= maxUsers) {
    return {
      allowed: false,
      error: `User limit reached. Your plan allows up to ${maxUsers} users. Please upgrade to add more.`,
      current: currentUsers,
      limit: maxUsers,
    }
  }

    return { allowed: true, error: null, current: currentUsers, limit: maxUsers }
  } catch (error: any) {
    // If there's an error, allow adding users (graceful degradation)
    return { allowed: true, error: null }
  }
}

// Check if company can add more drivers
export async function canAddDriver() {
  try {
    const limitsResult = await checkSubscriptionLimits()

    if (limitsResult.error || !limitsResult.limits) {
      // If no subscription, don't allow (require subscription)
      return { allowed: false, error: "No active subscription. Please subscribe to a plan first." }
    }

  const { maxDrivers } = limitsResult.limits

  // Unlimited
  if (maxDrivers === null) {
    return { allowed: true, error: null }
  }

  // Get current driver count
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, error: "Not authenticated" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { allowed: false, error: "No company found" }
  }

  const { count } = await supabase
    .from("drivers")
    .select("*", { count: "exact", head: true })
    .eq("company_id", userData.company_id)

  const currentDrivers = count || 0

  if (currentDrivers >= maxDrivers) {
    return {
      allowed: false,
      error: `Driver limit reached. Your plan allows up to ${maxDrivers} drivers. Please upgrade to add more.`,
      current: currentDrivers,
      limit: maxDrivers,
    }
  }

    return { allowed: true, error: null, current: currentDrivers, limit: maxDrivers }
  } catch (error: any) {
    // If there's an error, allow adding drivers (graceful degradation)
    return { allowed: true, error: null }
  }
}

// Check if company can use ELD features
export async function canUseELD() {
  try {
    const limitsResult = await checkSubscriptionLimits()

    if (limitsResult.error || !limitsResult.limits) {
      // If no subscription, don't allow ELD (requires subscription)
      return { 
        allowed: false, 
        error: "ELD features require a subscription. Please subscribe to a plan to access ELD integration." 
      }
    }

    // Check plan name for ELD access
    const plan = limitsResult.data?.subscription_plans
    const planName = plan?.name || ""
    const canUse = planName === "professional" || planName === "enterprise"

    return {
      allowed: canUse,
      error: canUse
        ? null
        : "ELD features are only available in Professional and Enterprise plans. Please upgrade to access ELD integration.",
    }
  } catch (error: any) {
    // If there's an error, don't allow ELD
    return { 
      allowed: false, 
      error: "Unable to verify subscription. Please try again later." 
    }
  }
}

// Get subscription status
export async function getSubscriptionStatus() {
  const limitsResult = await checkSubscriptionLimits()

  if (limitsResult.error || !limitsResult.data) {
    return {
      hasSubscription: false,
      isActive: false,
      isTrial: false,
      limits: null,
      error: limitsResult.error,
    }
  }

  const subscription = limitsResult.data
  const isActive = subscription.status === "active" || subscription.status === "trialing"
  const isTrial = subscription.status === "trialing"

  return {
    hasSubscription: true,
    isActive,
    isTrial,
    limits: limitsResult.limits,
    subscription,
    error: null,
  }
}

// Check if user can access a specific feature
export async function canAccessFeature(feature: string): Promise<{ allowed: boolean; error?: string; plan?: string }> {
  try {
    const limitsResult = await checkSubscriptionLimits()

    if (limitsResult.error || !limitsResult.data) {
      return { allowed: false, error: "No active subscription found" }
    }

    const subscription = limitsResult.data
    const plan = subscription.subscription_plans
    const planName = plan?.name || ""

    // Check if subscription is active or in trial
    const isActive = subscription.status === "active" || subscription.status === "trialing"
    if (!isActive) {
      return { allowed: false, error: "Subscription is not active" }
    }

    // Feature access based on plan
    const featureAccess: Record<string, string[]> = {
      starter: ["basic", "drivers", "trucks", "routes", "loads", "basic_reports", "accounting", "maintenance", "documents"],
      professional: ["basic", "drivers", "trucks", "routes", "loads", "basic_reports", "advanced_reports", "accounting", "maintenance", "documents", "eld", "gps_tracking", "ifta_eld", "advanced_analytics", "route_optimization"],
      enterprise: ["all"], // Enterprise has access to everything
    }

    const allowedFeatures = featureAccess[planName] || []
    const hasAccess = allowedFeatures.includes("all") || allowedFeatures.includes(feature)

    if (!hasAccess) {
      const planDisplayName = plan?.display_name || planName
      return {
        allowed: false,
        error: `${feature} is only available in ${planName === "starter" ? "Professional or Enterprise" : "Enterprise"} plans. Please upgrade.`,
        plan: planName,
      }
    }

    return { allowed: true, plan: planName }
  } catch (error: any) {
    return { allowed: false, error: error?.message || "Failed to check feature access" }
  }
}

