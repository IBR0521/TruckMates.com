import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Which truck this driver is operating for ELD. Fleet often assigns via
 * **Truck → current driver** or **Load → driver + truck**, but those do not
 * always set `drivers.truck_id`. We mirror dispatch reality by resolving in order:
 * 1) `drivers.truck_id` (explicit profile)
 * 2) `trucks.current_driver_id` = this driver
 * 3) Latest load with this driver + a truck (`pending` | `scheduled` | `in_transit`)
 */
export async function resolveTruckIdForDriver(
  supabase: SupabaseClient,
  companyId: string,
  driverId: string
): Promise<string | null> {
  const { data: dr } = await supabase
    .from("drivers")
    .select("truck_id")
    .eq("id", driverId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (dr?.truck_id) {
    return String(dr.truck_id)
  }

  const { data: truck } = await supabase
    .from("trucks")
    .select("id")
    .eq("company_id", companyId)
    .eq("current_driver_id", driverId)
    .limit(1)
    .maybeSingle()

  if (truck?.id) {
    return String(truck.id)
  }

  const { data: load } = await supabase
    .from("loads")
    .select("truck_id")
    .eq("company_id", companyId)
    .eq("driver_id", driverId)
    .in("status", ["pending", "scheduled", "in_transit"])
    .not("truck_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (load?.truck_id) {
    return String(load.truck_id)
  }

  return null
}
