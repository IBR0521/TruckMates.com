import { NextResponse } from "next/server"
import { syncAllEnabledFuelCardProviders } from "@/app/actions/fuel-card-import"
import { reportCronFailure } from "@/lib/cron/report"
import { errorMessage } from "@/lib/error-message"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncAllEnabledFuelCardProviders()
    if (result.error) {
      reportCronFailure("sync-fuel-card-transactions", result.error)
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error: unknown) {
    reportCronFailure("sync-fuel-card-transactions", error)
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 })
  }
}
