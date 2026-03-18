import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

function getRequiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Managers only
    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return NextResponse.redirect(
        new URL("/dashboard/settings/integration?quickbooks_error=forbidden", request.url)
      )
    }

    const clientId = getRequiredEnv("QUICKBOOKS_CLIENT_ID")
    const redirectUri = getRequiredEnv("QUICKBOOKS_REDIRECT_URI")

    const state = crypto.randomUUID()

    const response = NextResponse.redirect(
      new URL(
        `https://appcenter.intuit.com/connect/oauth2?` +
          new URLSearchParams({
            client_id: clientId,
            scope: "com.intuit.quickbooks.accounting",
            redirect_uri: redirectUri,
            response_type: "code",
            state,
            access_type: "offline",
          }).toString()
      )
    )

    // Store state + companyId in a short-lived httpOnly cookie to prevent CSRF
    response.cookies.set("qb_oauth_state", JSON.stringify({ state, companyId: ctx.companyId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    })

    // Ensure company_integrations row exists (best-effort; ignore any errors)
    try {
      const supabase = await createClient()
      await supabase
        .from("company_integrations")
        .upsert({ company_id: ctx.companyId }, { onConflict: "company_id", ignoreDuplicates: false })
        .select("id")
        .maybeSingle()
    } catch {
      // Non-fatal; connection flow will still work
    }

    return response
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings/integration?quickbooks_error=${encodeURIComponent(
          error?.message || "connect_failed"
        )}`,
        request.url
      )
    )
  }
}

