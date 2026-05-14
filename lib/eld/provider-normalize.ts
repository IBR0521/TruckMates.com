import type { EldDeviceSyncRow } from "@/lib/types/eld-sync"

export type EldProviderCanonical = "samsara" | "motive" | "geotab"

export function canonicalEldProvider(raw: string | null | undefined): EldProviderCanonical | null {
  const p = String(raw || "").trim().toLowerCase()
  if (p === "samsara") return "samsara"
  if (p === "geotab") return "geotab"
  if (p === "motive" || p === "keeptruckin") return "motive"
  return null
}

export function mappingProviderKeys(device: EldDeviceSyncRow): string[] {
  const p = String(device.provider || "").trim().toLowerCase()
  if (p === "keeptruckin" || p === "motive") return ["keeptruckin"]
  if (p === "samsara") return ["samsara"]
  if (p === "geotab") return ["geotab"]
  return [p].filter(Boolean)
}
