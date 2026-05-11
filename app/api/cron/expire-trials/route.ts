import { NextResponse } from "next/server"
import { getAdminClientForCron } from "@/lib/cron/admin-context"
import * as Sentry from "@sentry/nextjs"

/**
 * Backup for migration 215 pg_cron trial expiry (when pg_cron is not enabled on the project).
 * Idempotent SQL: only downgrades companies past trial_ends_at.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured - expire-trials disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = getAdminClientForCron()
    const { data, error } = await admin.rpc("apply_expired_trial_downgrades")

    if (error) {
      Sentry.captureException(error, { tags: { cron: "expire-trials" } })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const downgraded = typeof data === "number" ? data : 0
    return NextResponse.json({
      success: true,
      downgraded,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: "expire-trials" } })
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
