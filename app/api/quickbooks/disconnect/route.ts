import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

export async function POST(request: NextRequest) {
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

