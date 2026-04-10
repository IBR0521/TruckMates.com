import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getCurrentCompanyFeatureAccess } from "@/lib/plan-gates"

function getRequiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function getBaseUrl(isSandbox: boolean) {
  return isSandbox ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"
}

async function exchangeCodeForTokens(args: {
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
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
    const msg = json?.error_description || json?.error || "token_exchange_failed"
    throw new Error(msg)
  }

  return json as {
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in?: number
    token_type: string
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const realmId = url.searchParams.get("realmId")
  const oauthError = url.searchParams.get("error")

  try {
    const gate = await getCurrentCompanyFeatureAccess("quickbooks")
    if (!gate.allowed) {
      const response = NextResponse.redirect(
        new URL("/dashboard/settings/integration?quickbooks_error=upgrade_required", request.url)
      )
      response.cookies.set("qb_oauth_state", "", { path: "/", maxAge: 0 })
      return response
    }

    if (oauthError) {
      throw new Error(url.searchParams.get("error_description") || oauthError)
    }
    if (!code || !state || !realmId) {
      throw new Error("missing_parameters")
    }

    const cookie = request.cookies.get("qb_oauth_state")?.value
    if (!cookie) throw new Error("missing_state_cookie")

    let parsed: any = null
    try {
      parsed = JSON.parse(cookie)
    } catch {
      throw new Error("invalid_state_cookie")
    }
    if (!parsed?.state || parsed.state !== state || !parsed?.companyId) {
      throw new Error("state_mismatch")
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      throw new Error("not_authenticated")
    }
    if (ctx.companyId !== parsed.companyId) {
      throw new Error("company_mismatch")
    }

    const clientId = getRequiredEnv("QUICKBOOKS_CLIENT_ID")
    const clientSecret = getRequiredEnv("QUICKBOOKS_CLIENT_SECRET")
    const redirectUri = getRequiredEnv("QUICKBOOKS_REDIRECT_URI")
    const isSandbox = String(process.env.QUICKBOOKS_SANDBOX || "true").toLowerCase() === "true"

    const tokens = await exchangeCodeForTokens({ code, redirectUri, clientId, clientSecret })
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 0) * 1000).toISOString()

    const supabase = await createClient()
    const { error: upsertError } = await supabase
      .from("company_integrations")
      .upsert(
        {
          company_id: ctx.companyId,
          quickbooks_enabled: true,
          quickbooks_company_id: realmId,
          quickbooks_access_token: tokens.access_token,
          quickbooks_refresh_token: tokens.refresh_token,
          quickbooks_token_expires_at: expiresAt,
          quickbooks_sandbox: isSandbox,
          quickbooks_synced_at: null,
        },
        { onConflict: "company_id", ignoreDuplicates: false }
      )

    if (upsertError) throw new Error(upsertError.message || "database_error")

    // Best-effort: verify access by calling CompanyInfo once
    try {
      const baseUrl = getBaseUrl(isSandbox)
      const res = await fetch(
        `${baseUrl}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=73`,
        {
          headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
          cache: "no-store",
        }
      )
      if (!res.ok) {
        // Don't fail connection; user can test from UI
      }
    } catch {}

    const response = NextResponse.redirect(
      new URL("/dashboard/settings/integration?quickbooks_success=true", request.url)
    )
    response.cookies.set("qb_oauth_state", "", { path: "/", maxAge: 0 })
    return response
  } catch (error: unknown) {
    const response = NextResponse.redirect(
      new URL(
        `/dashboard/settings/integration?quickbooks_error=${encodeURIComponent(
          errorMessage(error, "oauth_failed")
        )}`,
        request.url
      )
    )
    response.cookies.set("qb_oauth_state", "", { path: "/", maxAge: 0 })
    return response
  }
}

