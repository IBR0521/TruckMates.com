import { NextResponse } from "next/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { cleanupReadNotifications } from "@/app/actions/notifications"
import { createAdminClient } from "@/lib/supabase/admin"

// Cron endpoint to cleanup read notifications and old audit logs.
// Runs on a schedule (Vercel Cron / external cron service).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // Fail-closed: require CRON_SECRET if set
  if (!cronSecret) {
    console.error("[Cron Cleanup] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // 1) Delete read notifications older than 90 days
    const notificationsResult = await cleanupReadNotifications(90)
    if (notificationsResult.error) {
      return NextResponse.json(
        { error: notificationsResult.error, success: false },
        { status: 500 }
      )
    }

    // 2) Delete audit logs older than 1 year
    const auditCutoffISO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    const { error: auditError } = await admin
      .from("audit_logs")
      .delete()
      .lt("created_at", auditCutoffISO)

    if (auditError) {
      return NextResponse.json(
        { error: sanitizeError(auditError, { fallback: "Failed to clean up audit logs" }), success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationsCleanup: notificationsResult.data,
        auditLogsCutoffISO: auditCutoffISO,
      },
    })
  } catch (error: unknown) {
    console.error("[Cron Cleanup] Unexpected error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Cleanup failed"), success: false },
      { status: 500 }
    )
  }
}

