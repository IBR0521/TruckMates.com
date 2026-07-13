import { NextResponse } from "next/server"
import { syncAllPendingFactoringStatuses } from "@/app/actions/factoring-api"
import { reportCronFailure } from "@/lib/cron/report"
import { errorMessage } from "@/lib/error-message"

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
    const result = await syncAllPendingFactoringStatuses()
    if (result.error) {
      reportCronFailure("sync-factoring-status", result.error)
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error: unknown) {
    reportCronFailure("sync-factoring-status", error)
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 })
  }
}
