import type { SupabaseClient } from "@supabase/supabase-js"

export type DtcTranslation = {
  short_description: string
  long_description: string | null
  severity: "critical" | "high" | "medium" | "low"
  category: string
  recommended_action: string
  estimated_repair_cost_low_usd: number | null
  estimated_repair_cost_high_usd: number | null
}

const OBD_PATTERN = /^P[0-9A-F]{4}$/i
const J1939_PATTERN = /^SPN-\d+-FMI-\d+$/i

export function detectCodeProtocol(code: string): "OBD2" | "J1939" | "J1708" | "manufacturer" | "unknown" {
  const c = code.trim().toUpperCase()
  if (J1939_PATTERN.test(c) || c.startsWith("SPN-")) return "J1939"
  if (c.startsWith("PID-") || c.includes("PID")) return "J1708"
  if (OBD_PATTERN.test(c) || c.startsWith("P0") || c.startsWith("P1") || c.startsWith("P2")) return "OBD2"
  if (/^[CUUB][0-9A-F]{4}$/i.test(c)) return "OBD2"
  return "unknown"
}

/** Normalize provider codes to lookup keys (SPN-100-FMI-3, P0420, etc.). */
export function normalizeFaultCode(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return "UNKNOWN"
  const upper = trimmed.toUpperCase()

  const j1939Match = upper.match(/SPN[:\s-]*(\d+)[\s./-]*FMI[:\s-]*(\d+)/i)
  if (j1939Match) {
    return `SPN-${j1939Match[1]}-FMI-${j1939Match[2]}`
  }

  const dotMatch = upper.match(/^(\d{1,5})\.(\d{1,2})$/)
  if (dotMatch) {
    return `SPN-${dotMatch[1]}-FMI-${dotMatch[2]}`
  }

  if (OBD_PATTERN.test(upper.replace(/\s/g, ""))) {
    return upper.replace(/\s/g, "")
  }

  return upper
}

export async function lookupDtcTranslation(
  admin: SupabaseClient,
  code: string,
  protocol: ReturnType<typeof detectCodeProtocol>,
): Promise<DtcTranslation | null> {
  const normalized = normalizeFaultCode(code)
  const protocols: string[] =
    protocol === "unknown"
      ? ["OBD2", "J1939", "J1708", "manufacturer"]
      : [protocol]

  for (const p of protocols) {
    const { data } = await admin
      .from("dtc_translations")
      .select(
        "short_description, long_description, severity, category, recommended_action, estimated_repair_cost_low_usd, estimated_repair_cost_high_usd",
      )
      .eq("code", normalized)
      .eq("protocol", p)
      .is("manufacturer", null)
      .maybeSingle()
    if (data) return data as DtcTranslation
  }

  const { data: unknownRow } = await admin
    .from("dtc_translations")
    .select(
      "short_description, long_description, severity, category, recommended_action, estimated_repair_cost_low_usd, estimated_repair_cost_high_usd",
    )
    .eq("code", "UNKNOWN")
    .eq("protocol", "OBD2")
    .is("manufacturer", null)
    .maybeSingle()

  return unknownRow ? (unknownRow as DtcTranslation) : null
}
