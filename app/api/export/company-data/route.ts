import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapLegacyRole } from "@/lib/roles"

export const dynamic = "force-dynamic"

const ROW_LIMIT = 2500

const TABLES_BY_COMPANY_ID = [
  "loads",
  "trucks",
  "drivers",
  "routes",
  "route_stops",
  "invoices",
  "expenses",
  "settlements",
  "maintenance",
  "ifta_reports",
  "documents",
  "customers",
  "vendors",
  "bols",
  "alerts",
] as const

async function fetchWithCompanyId(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  companyId: string,
): Promise<{ table: string; rows: unknown[]; error: string | null }> {
  const { data, error } = await admin.from(table).select("*").eq("company_id", companyId).limit(ROW_LIMIT)
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { table, rows: [], error: null }
    }
    return { table, rows: [], error: error.message }
  }
  return { table, rows: (data as unknown[]) ?? [], error: null }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, full_name, phone, role, company_id, created_at, employee_status")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
    if (!profile?.company_id) {
      return NextResponse.json({ error: "No company associated with this account" }, { status: 403 })
    }

    const companyId = profile.company_id
    const role = mapLegacyRole(profile.role)
    const isManager = role === "super_admin" || role === "operations_manager"

    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      export_scope: isManager ? "company_admin" : "session_rls",
      company_id: companyId,
      profile: profile,
    }

    const serviceConfigured =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

    if (isManager && serviceConfigured) {
      const admin = createAdminClient()

      const { data: company, error: companyErr } = await admin.from("companies").select("*").eq("id", companyId).maybeSingle()
      if (companyErr && !companyErr.message?.includes("does not exist")) {
        payload.company_error = companyErr.message
      } else {
        payload.company = company
      }

      const { data: roster, error: usersErr } = await admin
        .from("users")
        .select("id, email, full_name, phone, role, created_at, employee_status")
        .eq("company_id", companyId)
        .limit(ROW_LIMIT)

      if (usersErr) {
        payload.users_error = usersErr.message
      } else {
        payload.company_users = roster ?? []
      }

      const tables: Record<string, unknown> = {}
      const tableErrors: Record<string, string> = {}

      for (const table of TABLES_BY_COMPANY_ID) {
        const res = await fetchWithCompanyId(admin, table, companyId)
        if (res.error) tableErrors[table] = res.error
        else if (res.rows.length > 0) tables[table] = res.rows
      }

      payload.data_tables = tables
      if (Object.keys(tableErrors).length > 0) payload.table_errors = tableErrors

      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, status, plan_id, trial_start, trial_end, current_period_start, current_period_end, stripe_subscription_id, cancel_at_period_end")
        .eq("company_id", companyId)
        .maybeSingle()

      payload.subscription = sub ?? null
    } else {
      payload.note =
        serviceConfigured && !isManager
          ? "Non-manager export uses your session and row-level security; some tables may be empty."
          : !serviceConfigured
            ? "Service role key is not configured; export is limited to rows your session can read via RLS."
            : undefined

      const sessionTables = [
        "loads",
        "trucks",
        "drivers",
        "routes",
        "invoices",
        "documents",
        "customers",
        "vendors",
      ] as const

      const data: Record<string, unknown> = {}
      for (const table of sessionTables) {
        const { data: rows, error } = await supabase.from(table).select("*").limit(ROW_LIMIT)
        if (!error && rows && rows.length > 0) {
          data[table] = rows
        }
      }
      payload.data_tables = data
    }

    const body = JSON.stringify(payload, null, 2)
    const filename = `truckmates-export-${companyId.slice(0, 8)}-${Date.now()}.json`

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Export failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
