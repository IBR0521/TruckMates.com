import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

function getBaseUrl(isSandbox: boolean) {
  return isSandbox ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"
}

function getRequiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

async function refreshAccessToken(args: {
  refreshToken: string
  clientId: string
  clientSecret: string
}) {
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

export async function POST() {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return NextResponse.json({ error: ctx.error || "Not authenticated" }, { status: 401 })
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: row, error } = await supabase
      .from("company_integrations")
      .select(
        "quickbooks_enabled, quickbooks_company_id, quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at, quickbooks_sandbox"
      )
      .eq("company_id", ctx.companyId)
      .single()

    if (error || !row) return NextResponse.json({ error: "Not configured" }, { status: 400 })
    if (!row.quickbooks_enabled || !row.quickbooks_company_id) {
      return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 })
    }

    const realmId = String(row.quickbooks_company_id)
    let accessToken = row.quickbooks_access_token as string | null
    const refreshToken = row.quickbooks_refresh_token as string | null

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: "Missing QuickBooks tokens" }, { status: 400 })
    }

    const expiresAt = row.quickbooks_token_expires_at ? new Date(row.quickbooks_token_expires_at) : null
    const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 60_000
    const isSandbox = row.quickbooks_sandbox !== false

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
        .eq("company_id", ctx.companyId)
    }

    const baseUrl = getBaseUrl(isSandbox)
    const query = "select * from Account maxresults 1000"
    const res = await fetch(
      `${baseUrl}/v3/company/${encodeURIComponent(realmId)}/query?minorversion=73&query=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      }
    )

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      return NextResponse.json(
        { error: json?.Fault?.Error?.[0]?.Message || "QuickBooks API error", details: json },
        { status: 502 }
      )
    }

    const accounts = json?.QueryResponse?.Account || []

    await supabase
      .from("company_integrations")
      .update({ quickbooks_synced_at: new Date().toISOString() })
      .eq("company_id", ctx.companyId)

    return NextResponse.json({
      success: true,
      realmId,
      accounts_count: Array.isArray(accounts) ? accounts.length : 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

