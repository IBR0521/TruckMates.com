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

export async function POST(request: NextRequest) {
  try {
    const gate = await getCurrentCompanyFeatureAccess("quickbooks")
    if (!gate.allowed) {
      return NextResponse.json(
        { error: "QuickBooks is available on Fleet and Enterprise plans. Please upgrade to continue." },
        { status: 403 }
      )
    }

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

    // Best-effort token revoke (Intuit-side disconnect)
    try {
      const { data: row } = await supabase
        .from("company_integrations")
        .select("quickbooks_access_token, quickbooks_refresh_token")
        .eq("company_id", ctx.companyId)
        .maybeSingle()

      const tokenToRevoke = row?.quickbooks_refresh_token || row?.quickbooks_access_token
      if (tokenToRevoke) {
        const clientId = getRequiredEnv("QUICKBOOKS_CLIENT_ID")
        const clientSecret = getRequiredEnv("QUICKBOOKS_CLIENT_SECRET")
        const body = new URLSearchParams({ token: tokenToRevoke })
        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

        await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/revoke", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body,
        })
      }
    } catch {
      // Non-fatal; still proceed with local disconnect
    }

    const { error } = await supabase
      .from("company_integrations")
      .update({
        quickbooks_enabled: false,
        quickbooks_company_id: null,
        quickbooks_access_token: null,
        quickbooks_refresh_token: null,
        quickbooks_token_expires_at: null,
        quickbooks_synced_at: null,
      })
      .eq("company_id", ctx.companyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Internal server error") }, { status: 500 })
  }
}

