import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { minimumTierForFeature, planTierLabel, type PlanFeatures } from "@/lib/plan-limits"

export type PlanFeatureGuardResult =
  | { allowed: true }
  | { allowed: false; error: string }

export async function checkPlanFeature(
  companyId: string,
  feature: keyof PlanFeatures,
): Promise<PlanFeatureGuardResult> {
  const gate = await checkFeatureAccess({ companyId, feature })
  if (gate.allowed) return { allowed: true }
  const minTier = planTierLabel(minimumTierForFeature(feature))
  return {
    allowed: false,
    error: `This feature requires the ${minTier} plan or higher.`,
  }
}

/** Returns error string when feature is not allowed, or null when OK. */
export async function requirePlanFeature(
  companyId: string,
  feature: keyof PlanFeatures,
): Promise<string | null> {
  const result = await checkPlanFeature(companyId, feature)
  return result.allowed ? null : result.error
}
