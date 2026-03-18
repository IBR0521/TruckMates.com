import { NextResponse } from "next/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"
import { getQuickBooksConnection, qbFetch } from "@/lib/quickbooks/client"

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

    // Ensure company_integrations tokens exist and are valid (token refresh happens inside).
    const conn = await getQuickBooksConnection(ctx.companyId)
    const json = await qbFetch(conn, `/companyinfo/${encodeURIComponent(conn.realmId)}`, { method: "GET" })
    return NextResponse.json({
      success: true,
      realmId: conn.realmId,
      companyInfo: json?.CompanyInfo || json,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

