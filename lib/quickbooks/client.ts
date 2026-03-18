import { createClient } from "@/lib/supabase/server"

export type QuickBooksConnection = {
  companyId: string
  realmId: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: string | null
  sandbox: boolean
}

function getBaseUrl(isSandbox: boolean) {
  return isSandbox ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"
}

function getRequiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

async function refreshAccessToken(args: { refreshToken: string; clientId: string; clientSecret: string }) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  })

  const basic = Buffer.from(`${args.clientId}:${args.clientSecret}`).toString("base64")
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error_description || json?.error || "refresh_failed"
    throw new Error(msg)
  }
  return json as { access_token: string; refresh_token?: string; expires_in: number }
}

export async function getQuickBooksConnection(companyId: string): Promise<QuickBooksConnection> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("company_integrations")
    .select(
      "quickbooks_enabled, quickbooks_company_id, quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at, quickbooks_sandbox"
    )
    .eq("company_id", companyId)
    .single()

  if (error || !data) throw new Error("QuickBooks not configured")
  if (!data.quickbooks_enabled || !data.quickbooks_company_id) throw new Error("QuickBooks not connected")

  const realmId = String(data.quickbooks_company_id)
  let accessToken = data.quickbooks_access_token as string | null
  const refreshToken = data.quickbooks_refresh_token as string | null

  if (!accessToken || !refreshToken) throw new Error("Missing QuickBooks tokens")

  const expiresAt = data.quickbooks_token_expires_at ? new Date(data.quickbooks_token_expires_at) : null
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 60_000
  const sandbox = data.quickbooks_sandbox !== false

  if (isExpired) {
    const clientId = getRequiredEnv("QUICKBOOKS_CLIENT_ID")
    const clientSecret = getRequiredEnv("QUICKBOOKS_CLIENT_SECRET")
    const refreshed = await refreshAccessToken({ refreshToken, clientId, clientSecret })
    accessToken = refreshed.access_token
    const newExpiresAt = new Date(Date.now() + Number(refreshed.expires_in || 0) * 1000).toISOString()

    await supabase
      .from("company_integrations")
      .update({
        quickbooks_access_token: accessToken,
        quickbooks_refresh_token: refreshed.refresh_token || refreshToken,
        quickbooks_token_expires_at: newExpiresAt,
      })
      .eq("company_id", companyId)
  }

  return {
    companyId,
    realmId,
    accessToken: accessToken!,
    refreshToken,
    tokenExpiresAt: data.quickbooks_token_expires_at ? String(data.quickbooks_token_expires_at) : null,
    sandbox,
  }
}

export async function qbFetch(
  conn: QuickBooksConnection,
  path: string,
  init?: RequestInit & { minorversion?: string }
) {
  const baseUrl = getBaseUrl(conn.sandbox)
  const minor = init?.minorversion || "73"
  const url = `${baseUrl}/v3/company/${encodeURIComponent(conn.realmId)}${path}${
    path.includes("?") ? "&" : "?"
  }minorversion=${encodeURIComponent(minor)}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.Fault?.Error?.[0]?.Message || json?.Fault?.Error?.[0]?.Detail || "QuickBooks API error"
    const err = new Error(msg)
    ;(err as any).details = json
    throw err
  }
  return json
}

export async function qbQuery(conn: QuickBooksConnection, query: string) {
  return qbFetch(conn, `/query?query=${encodeURIComponent(query)}`, { method: "GET" })
}

