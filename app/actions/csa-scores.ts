"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { checkViewPermission } from "@/lib/server-permissions"

// The CSA sync workers (syncCompanyCSAScores / syncAllCompaniesCSAScores) live in
// lib/compliance/csa-sync.ts — a plain module, NOT a "use server" action (F9), imported by the
// sync-csa-scores cron. This file keeps only the authenticated, company-scoped reader.

export async function getCSAScoreHistory(limit = 12) {
  try {
    const permission = await checkViewPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data, error } = await supabase
      .from("csa_scores")
      .select("id, snapshot_month, unsafe_driving, hours_of_service, driver_fitness, controlled_substances, vehicle_maintenance, hazardous_materials, crash_indicator, dot_number")
      .eq("company_id", ctx.companyId)
      .order("snapshot_month", { ascending: false })
      .limit(Math.min(limit, 60))
    if (error) return { error: "Failed to load CSA scores", data: null }
    return { data: (data || []).reverse(), error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load CSA scores"), data: null }
  }
}
