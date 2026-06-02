import { callClaude } from "@/lib/ai/client"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"

export type DocumentKind = "rate_confirmation" | "bol"

export type Accessorial = {
  name: string
  amount_usd: number | null
}

export type ExtractedRateConOrBol = {
  document_kind: DocumentKind
  confidence: number
  broker_name: string | null
  load_reference: string | null
  lane: { origin: string | null; destination: string | null }
  weight_lbs: number | null
  pickup_date: string | null // YYYY-MM-DD
  delivery_date: string | null // YYYY-MM-DD
  rate_total_usd: number | null
  accessorials: Accessorial[]
}

const STRICT_SCHEMA = `Return ONLY valid JSON matching this schema (no markdown, no trailing commentary):
{
  "document_kind": "rate_confirmation" | "bol",
  "confidence": number, // 0..1
  "broker_name": string | null,
  "load_reference": string | null,
  "lane": { "origin": string | null, "destination": string | null },
  "weight_lbs": number | null,
  "pickup_date": string | null,   // YYYY-MM-DD if present
  "delivery_date": string | null, // YYYY-MM-DD if present
  "rate_total_usd": number | null,
  "accessorials": [ { "name": string, "amount_usd": number | null } ]
}`

function asString(v: unknown): string | null {
  const s = String(v ?? "").trim()
  return s ? s : null
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const s = String(v ?? "").trim()
  if (!s) return null
  const n = Number(s.replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) ? n : null
}

function clamp01(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function normalizeKind(v: unknown): DocumentKind {
  const t = String(v ?? "").trim().toLowerCase()
  return t.includes("bol") || t.includes("bill") ? "bol" : "rate_confirmation"
}

function normalizeDate(v: unknown): string | null {
  const s = String(v ?? "").trim()
  if (!s) return null
  // Accept YYYY-MM-DD or YYYY/MM/DD or MM/DD/YYYY; normalize to YYYY-MM-DD when unambiguous.
  const iso = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (us) {
    const mm = us[1].padStart(2, "0")
    const dd = us[2].padStart(2, "0")
    return `${us[3]}-${mm}-${dd}`
  }
  return s.length <= 32 ? s : null
}

export function parseExtractedStructured(raw: unknown): ExtractedRateConOrBol {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const laneRaw = o.lane && typeof o.lane === "object" && !Array.isArray(o.lane) ? (o.lane as Record<string, unknown>) : {}
  const accessorialsRaw = Array.isArray(o.accessorials) ? o.accessorials : []

  const accessorials: Accessorial[] = []
  for (const a of accessorialsRaw) {
    const ar = a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {}
    const name = asString(ar.name)
    if (!name) continue
    accessorials.push({ name, amount_usd: asNumber(ar.amount_usd) })
  }

  return {
    document_kind: normalizeKind(o.document_kind),
    confidence: clamp01(o.confidence),
    broker_name: asString(o.broker_name),
    load_reference: asString(o.load_reference),
    lane: {
      origin: asString(laneRaw.origin),
      destination: asString(laneRaw.destination),
    },
    weight_lbs: asNumber(o.weight_lbs),
    pickup_date: normalizeDate(o.pickup_date),
    delivery_date: normalizeDate(o.delivery_date),
    rate_total_usd: asNumber(o.rate_total_usd),
    accessorials,
  }
}

export async function extractStructuredFieldsFromBase64(params: {
  base64: string
  mediaType: string
  fileName: string
  companyId: string
  hintedKind: DocumentKind | null
}): Promise<{ data: ExtractedRateConOrBol | null; error: string | null; model: string | null }> {
  const prompt = [
    "You extract fields from freight documents (rate confirmations and bills of lading).",
    "Goal: produce structured fields for billing/settlement checks. Be conservative: if a field is not explicit, return null.",
    STRICT_SCHEMA,
    "",
    `Hinted kind (may be wrong): ${params.hintedKind || "(unknown)"}`,
    `File name: ${params.fileName}`,
    `Media type: ${params.mediaType}`,
    "Base64 content:",
    params.base64,
  ].join("\n")

  const res = await callClaude<Record<string, unknown>>(
    `${LOGISTICS_SYSTEM_PROMPT}\n\nExtract structured fields for discrepancy checks.`,
    prompt,
    {
      expectJson: true,
      maxTokens: 1200,
      model: "sonnet",
      feature: "document_structured_extraction",
      companyId: params.companyId,
      cacheSystemPrompt: true,
    },
  )

  if (res.error || !res.data) return { data: null, error: res.error || "Extraction unavailable", model: null }
  return { data: parseExtractedStructured(res.data), error: null, model: typeof res.model === "string" ? res.model : null }
}

