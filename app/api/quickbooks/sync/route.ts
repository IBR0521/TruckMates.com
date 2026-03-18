import { NextResponse } from "next/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"
import { getQuickBooksConnection, qbQuery } from "@/lib/quickbooks/client"

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
    const conn = await getQuickBooksConnection(ctx.companyId)
    const query = "select * from Account maxresults 1000"
    const res = await qbQuery(conn, query)
    const accounts = res?.QueryResponse?.Account || []

    await supabase
      .from("company_integrations")
      .update({ quickbooks_synced_at: new Date().toISOString() })
      .eq("company_id", ctx.companyId)

    return NextResponse.json({
      success: true,
      realmId: conn.realmId,
      accounts_count: Array.isArray(accounts) ? accounts.length : 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

