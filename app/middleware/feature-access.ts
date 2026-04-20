"use server"

import { checkViewPermission } from "@/lib/server-permissions"
import { getCurrentCompanyFeatureAccess, type PlanFeature } from "@/lib/plan-gates"
import type { FeatureCategory } from "@/lib/feature-permissions"

export const FEATURE_ACCESS = {
  all: ["all"],
}

const PREMIUM_FEATURE_BY_SLUG: Record<string, PlanFeature> = {
  route_optimization: "route_optimization",
  geofencing: "geofencing",
  crm: "crm",
  api_keys: "api_keys",
  quickbooks: "quickbooks",
  driver_scorecards: "driver_scorecards",
}

/**
 * Server-side feature access helper used by pages/actions that need explicit checks.
 * Combines RBAC visibility with plan-based premium feature gates.
 */
export async function checkFeatureAccess(feature: string) {
  const view = await checkViewPermission(feature as FeatureCategory)
  if (!view.allowed) {
    return { allowed: false, error: view.error || "Access denied" }
  }

  const premiumFeature = PREMIUM_FEATURE_BY_SLUG[feature]
  if (premiumFeature) {
    const planAccess = await getCurrentCompanyFeatureAccess(premiumFeature)
    if (!planAccess.allowed) {
      return {
        allowed: false,
        error: planAccess.error || `${feature} is not available on your current plan.`,
      }
    }
  }

  return { allowed: true, error: null }
}
