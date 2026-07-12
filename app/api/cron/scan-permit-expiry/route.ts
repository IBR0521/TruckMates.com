import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { scanAllPermitExpiryAlerts } from "@/app/actions/permit-expiry-notify"
import { reportCronFailure } from "@/lib/cron/report"

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
    const result = await scanAllPermitExpiryAlerts()
    if (result.error) {
      reportCronFailure("scan-permit-expiry", result.error)
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (err: unknown) {
    reportCronFailure("scan-permit-expiry", err)
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Permit expiry scan failed") },
      { status: 500 },
    )
  }
}
