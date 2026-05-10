/** Google Maps / TollGuru monthly caps by TruckMates plan tier (aligns with `lib/plan-limits`). */

import type { PlanTier } from "@/lib/plan-limits"

export type GoogleUsageCategory =
  | "directions"
  | "geocoding"
  | "distance_matrix"
  | "places"
  | "toll_routing"

const UNLIMITED = 9_999_999

type ApiLimitsRow = Record<GoogleUsageCategory, number>

/** Keys include legacy `free` for older subscription_plans naming. */
export const API_MONTHLY_LIMITS: Record<string, ApiLimitsRow> = {
  free: {
    directions: 200,
    geocoding: 200,
    distance_matrix: 200,
    places: 200,
    toll_routing: 100,
  },
  owner_operator: {
    directions: 400,
    geocoding: 350,
    distance_matrix: 500,
    places: 280,
    toll_routing: 180,
  },
  starter: {
    directions: 500,
    geocoding: 400,
    distance_matrix: 600,
    places: 300,
    toll_routing: 200,
  },
  professional: {
    directions: 3000,
    geocoding: 1500,
    distance_matrix: 2500,
    places: 1200,
    toll_routing: 1500,
  },
  fleet: {
    directions: 8000,
    geocoding: 4000,
    distance_matrix: 7000,
    places: 3500,
    toll_routing: 4000,
  },
  enterprise: {
    directions: UNLIMITED,
    geocoding: UNLIMITED,
    distance_matrix: UNLIMITED,
    places: UNLIMITED,
    toll_routing: UNLIMITED,
  },
}

export function mapUsageActionToCategory(action: string): GoogleUsageCategory | null {
  switch (action) {
    case "directions":
    case "optimize_route":
      return "directions"
    case "geocoding":
    case "reverse_geocode":
      return "geocoding"
    case "distance_matrix":
      return "distance_matrix"
    case "place_details":
    case "places_autocomplete":
      return "places"
    case "toll_cost_estimate":
      return "toll_routing"
    default:
      return null
  }
}

/** Billable rows from `api_usage_log` where api_name !== google_maps (e.g. TollGuru). */
export function mapBillableUsageToCategory(
  apiName: string,
  action: string,
): GoogleUsageCategory | null {
  if (apiName === "tollguru" && action === "toll_cost_estimate") return "toll_routing"
  return mapUsageActionToCategory(action)
}

const DEFAULT_ROW = API_MONTHLY_LIMITS.starter

export function monthlyLimitForPlanTier(tier: PlanTier, category: GoogleUsageCategory): number {
  const row = API_MONTHLY_LIMITS[tier] || DEFAULT_ROW
  return row[category] ?? DEFAULT_ROW[category]
}

/** @deprecated Prefer `monthlyLimitForPlanTier` with company `subscription_tier`. */
export function monthlyLimitForPlan(planName: string | null | undefined, category: GoogleUsageCategory): number {
  const key = (planName || "starter").toLowerCase().replace(/-/g, "_")
  const row = API_MONTHLY_LIMITS[key] || DEFAULT_ROW
  return row[category] ?? DEFAULT_ROW[category]
}
