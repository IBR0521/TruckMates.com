import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorMessage } from "@/lib/error-message"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency"
import { syncFaultCodesForCompany } from "@/lib/eld/fault-codes-sync"

export const maxDuration = 300

async function companyTier(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<PlanTier> {
  const { data } = await admin.from("companies").select("subscription_tier").eq("id", companyId).maybeSingle()
  const raw = (data as { subscription_tier?: string | null } | null)?.subscription_tier
  return normalizePlanTier(raw ?? undefined)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const cronSecret = process.env.CRON_SECRET
  const isAuthorizedBySecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAuthorizedByVercelCron = !!vercelCronHeader
  if (!isAuthorizedBySecret && !isAuthorizedByVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: devices, error: dErr } = await admin
      .from("eld_devices")
      .select("company_id")
      .eq("status", "active")

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 })
    }

    const companyIds = [
      ...new Set((devices ?? []).map((r: { company_id?: string }) => String(r.company_id || "")).filter(Boolean)),
    ]

    const eligible: string[] = []
    for (const cid of companyIds) {
      const tier = await companyTier(admin, cid)
      if (!hasFeatureAccess(tier, "eld_fault_codes_basic")) continue
      eligible.push(cid)
    }

    const results = await mapWithConcurrency(eligible, 5, async (companyId) => {
      const r = await syncFaultCodesForCompany(companyId)
      return { companyId, ...r }
    })

    return NextResponse.json({
      ok: true,
      companies: eligible.length,
      results,
    })
  } catch (e: unknown) {
    Sentry.captureException(e)
    return NextResponse.json({ error: errorMessage(e, "Cron failed") }, { status: 500 })
  }
}
