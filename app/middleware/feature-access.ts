"use server"

// Plan-based feature gates are not wired here yet — navigation uses RBAC (`lib/feature-permissions`).
// Billing state lives in `subscriptions` + `subscription_plans`; seat limits are enforced in server actions.
export const FEATURE_ACCESS = {
  all: ["all"],
}

export async function checkFeatureAccess(_feature: string) {
  return { allowed: true, error: null }
}
