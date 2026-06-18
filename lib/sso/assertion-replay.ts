import { createAdminClient } from "@/lib/supabase/admin"

export function extractAssertionIdFromSamlResponse(samlResponseBase64: string): string | null {
  try {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8")
    const match = xml.match(/<(?:[\w-]+:)?Assertion\b[^>]*\sID="([^"]+)"/i)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

export function extractNotOnOrAfterFromSamlResponse(samlResponseBase64: string): Date | null {
  try {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8")
    const match = xml.match(/NotOnOrAfter="([^"]+)"/i)
    if (!match?.[1]) return null
    const parsed = new Date(match[1])
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

function assertionExpiresAt(notOnOrAfter: Date | null): string {
  const base = notOnOrAfter ?? new Date(Date.now() + 5 * 60 * 1000)
  const withBuffer = new Date(base.getTime() + 5 * 60 * 1000)
  return withBuffer.toISOString()
}

/**
 * Inserts assertion ID before completing login. Returns `replay` if already consumed.
 */
export async function reserveConsumedAssertion(params: {
  assertionId: string
  companyId: string
  notOnOrAfter: Date | null
}): Promise<"ok" | "replay"> {
  const admin = createAdminClient()
  const expiresAt = assertionExpiresAt(params.notOnOrAfter)

  const { data, error } = await admin
    .from("sso_consumed_assertions")
    .insert({
      assertion_id: params.assertionId,
      company_id: params.companyId,
      expires_at: expiresAt,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      return "replay"
    }
    throw error
  }

  return data ? "ok" : "replay"
}

export async function purgeExpiredSsoConsumedAssertions(): Promise<number> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("sso_consumed_assertions")
    .delete()
    .lt("expires_at", now)
    .select("id")

  if (error) throw error
  return data?.length ?? 0
}
