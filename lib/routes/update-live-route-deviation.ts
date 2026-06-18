import type { SupabaseClient } from "@supabase/supabase-js"

/** Update current_deviation_meters on in_progress routes for a truck position. */
export async function updateLiveRouteDeviation(
  supabase: SupabaseClient,
  params: {
    companyId: string
    truckId: string
    latitude: number
    longitude: number
  },
): Promise<void> {
  const { companyId, truckId, latitude, longitude } = params
  if (!companyId || !truckId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return

  try {
    await supabase.rpc("update_current_route_deviation_for_truck", {
      p_company_id: companyId,
      p_truck_id: truckId,
      p_lat: latitude,
      p_lng: longitude,
    })
  } catch {
    // non-blocking — deviation alerts are best-effort
  }
}
