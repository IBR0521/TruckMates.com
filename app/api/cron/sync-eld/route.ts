import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { syncAllELDDevicesForCron } from "@/app/actions/eld-sync"
import * as Sentry from "@sentry/nextjs"

// This endpoint can be called by Vercel Cron or external cron service
// To set up in Vercel: Add to vercel.json or use Vercel Cron Jobs
export async function GET(request: Request) {
  // SECURITY: Fail-closed - require CRON_SECRET if set
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncAllELDDevicesForCron()

    if (result.error) {
      Sentry.captureException(new Error(result.error), { tags: { cron: "sync-eld" } })
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Synced ${result.data?.synced || 0} devices, ${result.data?.failed || 0} failed, ${result.data?.companies || 0} companies`,
    })
  } catch (error: unknown) {
    console.error("Cron sync error:", error)
    Sentry.captureException(error, { tags: { cron: "sync-eld" } })
    return NextResponse.json(
      { error: errorMessage(error), success: false },
      { status: 500 }
    )
  }
}

