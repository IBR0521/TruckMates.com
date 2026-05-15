import { createAdminClient } from "@/lib/supabase/admin"
import type { DiscoveredVehicle } from "@/lib/eld/vehicle-discovery"

export type VehicleMatchConfidence = "high" | "medium" | "low" | "none"

export type VehicleMatchResult = {
  discovered: DiscoveredVehicle
  truck_id: string | null
  confidence: VehicleMatchConfidence
  match_reason: string
}

function normalizeUnit(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const na = normalizeUnit(a)
  const nb = normalizeUnit(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

export async function autoMatchVehicles(params: {
  companyId: string
  discoveredVehicles: DiscoveredVehicle[]
}): Promise<{ matches: VehicleMatchResult[] }> {
  const admin = createAdminClient()
  const { data: trucks } = await admin
    .from("trucks")
    .select("id, truck_number, vin, license_plate")
    .eq("company_id", params.companyId)

  const fleet = (trucks ?? []) as Array<{
    id: string
    truck_number?: string | null
    vin?: string | null
    license_plate?: string | null
  }>

  const matches: VehicleMatchResult[] = []

  for (const d of params.discoveredVehicles) {
    let truck_id: string | null = null
    let confidence: VehicleMatchConfidence = "none"
    let match_reason = "No match — select manually"

    if (d.vin) {
      const hit = fleet.find((t) => t.vin && t.vin.toUpperCase() === d.vin!.toUpperCase())
      if (hit) {
        truck_id = hit.id
        confidence = "high"
        match_reason = "VIN matches"
      }
    }

    if (!truck_id && d.license_plate) {
      const plate = d.license_plate.replace(/\s/g, "").toUpperCase()
      const hit = fleet.find(
        (t) => t.license_plate && t.license_plate.replace(/\s/g, "").toUpperCase() === plate,
      )
      if (hit) {
        truck_id = hit.id
        confidence = "high"
        match_reason = "License plate matches"
      }
    }

    if (!truck_id && d.name) {
      const hit = fleet.find((t) => t.truck_number && fuzzyNameMatch(d.name, t.truck_number))
      if (hit) {
        truck_id = hit.id
        confidence = "medium"
        match_reason = "Unit number matches"
      }
    }

    if (!truck_id && d.name) {
      const hit = fleet.find((t) => t.truck_number && fuzzyNameMatch(d.name, `Truck ${t.truck_number}`))
      if (hit) {
        truck_id = hit.id
        confidence = "low"
        match_reason = "Name similar to TruckMates truck"
      }
    }

    matches.push({ discovered: d, truck_id, confidence, match_reason })
  }

  return { matches }
}
