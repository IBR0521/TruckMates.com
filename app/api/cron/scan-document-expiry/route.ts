import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { scanAllDocumentExpiryAlerts } from "@/app/actions/document-expiry-notify"
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
    const result = await scanAllDocumentExpiryAlerts()
    if (result.error) {
      reportCronFailure("scan-document-expiry", result.error)
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (err: unknown) {
    reportCronFailure("scan-document-expiry", err)
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Document expiry scan failed") },
      { status: 500 },
    )
  }
}
