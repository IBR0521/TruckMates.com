import { getSpAcsUrl, getSpEntityId } from "@/lib/sso/sp-metadata"
import type { SsoFailureCategory } from "@/lib/sso/audit"

type ParsedExtract = {
  audience?: string | string[]
  response?: {
    destination?: string
    Destination?: string
    inResponseTo?: string
    InResponseTo?: string
  }
}

function normalizeAudience(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

export function validateParsedSamlConstraints(extract: ParsedExtract): SsoFailureCategory | null {
  const expectedAudience = getSpEntityId()
  const audiences = normalizeAudience(extract.audience)
  if (audiences.length > 0 && !audiences.includes(expectedAudience)) {
    return "audience_mismatch"
  }

  const destination =
    extract.response?.destination ||
    extract.response?.Destination ||
    null

  if (destination && destination !== getSpAcsUrl()) {
    return "recipient_mismatch"
  }

  return null
}

export function extractAudienceFromSamlResponse(samlResponseBase64: string): string | null {
  try {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8")
    const match = xml.match(
      /<(?:[\w-]+:)?AudienceRestriction\b[\s\S]*?<(?:[\w-]+:)?Audience\b[^>]*>([^<]+)<\/(?:[\w-]+:)?Audience>/i,
    )
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

export function validateSamlAudienceFromXml(samlResponseBase64: string): SsoFailureCategory | null {
  const audience = extractAudienceFromSamlResponse(samlResponseBase64)
  if (audience && audience !== getSpEntityId()) {
    return "audience_mismatch"
  }
  return null
}

export function validateSamlDestinationFromXml(samlResponseBase64: string): SsoFailureCategory | null {
  try {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8")
    const match = xml.match(/<(?:[\w-]+:)?Response\b[^>]*\sDestination="([^"]+)"/i)
    const destination = match?.[1]?.trim()
    if (destination && destination !== getSpAcsUrl()) {
      return "recipient_mismatch"
    }
    return null
  } catch {
    return null
  }
}
