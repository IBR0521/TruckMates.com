"use server"

import { canAccessFeature } from "@/app/actions/subscription-limits"

// Feature definitions based on plans
export const FEATURE_ACCESS = {
  // Starter plan features
  starter: [
    "drivers",
    "trucks",
    "routes",
    "loads",
    "basic_reports",
    "accounting",
    "maintenance",
    "documents",
    "employees",
  ],
  // Professional plan features (includes all starter +)
  professional: [
    "drivers",
    "trucks",
    "routes",
    "loads",
    "basic_reports",
    "advanced_reports",
    "accounting",
    "maintenance",
    "documents",
    "employees",
    "eld",
    "gps_tracking",
    "ifta_eld",
    "advanced_analytics",
    "route_optimization",
  ],
  // Enterprise plan (everything)
  enterprise: ["all"],
}

// Check if current user can access a feature
export async function checkFeatureAccess(feature: string) {
  return await canAccessFeature(feature)
}

