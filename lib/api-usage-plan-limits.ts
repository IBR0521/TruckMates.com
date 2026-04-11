/** Soft monthly caps per strategy doc (Operator/Fleet/Enterprise ↔ starter/professional/enterprise). Enterprise = effectively unlimited for Google Maps meters. */

export type GoogleUsageCategory =
  | "directions"
  | "geocoding"
  | "distance_matrix"
  | "places"
  | "toll_routing"

const UNLIMITED = 9_999_999

/** Maps subscription_plans.name → monthly usage limits per tracked API category. */
export const API_MONTHLY_LIMITS: Record<
  string,
  Record<GoogleUsageCategory, number>
> = {
  free: {
    directions: 200,
    geocoding: 200,
    distance_matrix: 200,
    places: 200,
    toll_routing: 100,
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

export function monthlyLimitForPlan(planName: string | null | undefined, category: GoogleUsageCategory): number {
  const key = (planName || "starter").toLowerCase()
  const row = API_MONTHLY_LIMITS[key] || API_MONTHLY_LIMITS.starter
  return row[category] ?? API_MONTHLY_LIMITS.starter[category]
}
