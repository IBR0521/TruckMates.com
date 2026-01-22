"use server"

// Feature access - platform is now free, all features are available
export const FEATURE_ACCESS = {
  // All features are available (platform is free)
  all: ["all"],
}

// Check if current user can access a feature
// Platform is free, so all features are accessible
export async function checkFeatureAccess(feature: string) {
  return { allowed: true, error: null }
}
