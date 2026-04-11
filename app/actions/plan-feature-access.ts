"use server"

import { getCurrentCompanyFeatureAccess, type PlanFeature } from "@/lib/plan-gates"

export async function getPlanFeatureAccessStatus(feature: PlanFeature): Promise<{
  data: { allowed: boolean; plan_name: string } | null
  error: string | null
}> {
  const gate = await getCurrentCompanyFeatureAccess(feature)
  if (gate.error) {
    return { data: null, error: gate.error }
  }

  return {
    data: {
      allowed: gate.allowed,
      plan_name: gate.planName,
    },
    error: null,
  }
}
