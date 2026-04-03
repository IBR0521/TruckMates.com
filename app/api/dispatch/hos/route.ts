import { NextRequest, NextResponse } from "next/server"
import { getMobileAuthContext } from "@/lib/auth/mobile"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeDriversHOSStatusWithCompany } from "@/app/actions/dispatcher-hos"

export async function GET(request: NextRequest) {
  const ctx = await getMobileAuthContext(request)
  if (ctx.error || !ctx.companyId) {
    return NextResponse.json({ error: ctx.error || "Not authenticated" }, { status: 401 })
  }

  try {
    const { data, error } = await computeDriversHOSStatusWithCompany(ctx.companyId, () => createAdminClient())
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load HOS" }, { status: 500 })
  }
}
