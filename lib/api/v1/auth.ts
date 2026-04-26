import crypto from "crypto"
import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type ApiKeyAuthResult =
  | {
      ok: true
      companyId: string
      apiKeyId: string
      scopes: string[]
      ipAddress: string | null
      userAgent: string | null
    }
  | { ok: false; status: number; error: string }

function parseApiKeyFromRequest(request: NextRequest): string | null {
  const direct = request.headers.get("x-api-key")
  if (direct) return direct.trim()
  const auth = request.headers.get("authorization") || ""
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  return null
}

export async function authenticateApiKey(request: NextRequest, requiredScope: "read" | "write"): Promise<ApiKeyAuthResult> {
  try {
    const apiKey = parseApiKeyFromRequest(request)
    if (!apiKey) return { ok: false, status: 401, error: "Missing API key" }

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex")
    const supabase = createAdminClient()

    const { data: keyRow, error } = await supabase
      .from("api_keys")
      .select("id, company_id, is_active, expires_at, scopes, allowed_ips")
      .eq("key_hash", keyHash)
      .maybeSingle()

    if (error || !keyRow) return { ok: false, status: 401, error: "Invalid API key" }
    if (!keyRow.is_active) return { ok: false, status: 403, error: "API key is inactive" }
    if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
      return { ok: false, status: 403, error: "API key is expired" }
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
    if (Array.isArray(keyRow.allowed_ips) && keyRow.allowed_ips.length > 0 && ipAddress) {
      const allowed = keyRow.allowed_ips.includes(ipAddress)
      if (!allowed) return { ok: false, status: 403, error: "IP address is not allowed for this key" }
    }

    const scopes = Array.isArray(keyRow.scopes) ? keyRow.scopes.map(String) : ["read"]
    const hasScope = scopes.includes("admin") || scopes.includes(requiredScope)
    if (!hasScope) return { ok: false, status: 403, error: `API key missing '${requiredScope}' scope` }

    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id)

    return {
      ok: true,
      companyId: keyRow.company_id,
      apiKeyId: keyRow.id,
      scopes,
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    }
  } catch {
    return { ok: false, status: 500, error: "Failed to authenticate API key" }
  }
}

export async function recordApiUsage(args: {
  apiKeyId: string
  companyId: string
  endpoint: string
  method: string
  statusCode: number
  startedAt: number
  ipAddress: string | null
  userAgent: string | null
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from("api_key_usage").insert({
      api_key_id: args.apiKeyId,
      company_id: args.companyId,
      endpoint: args.endpoint,
      method: args.method,
      status_code: args.statusCode,
      response_time_ms: Math.max(0, Date.now() - args.startedAt),
      ip_address: args.ipAddress,
      user_agent: args.userAgent,
    })
  } catch {
    // Non-blocking
  }
}
