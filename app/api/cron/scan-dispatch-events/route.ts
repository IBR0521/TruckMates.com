import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { scanAllDispatchEvents } from "@/app/actions/dispatch-event-notify"

/** Missed check-calls, driver-late, and emergency escalations run via process-deadline-sweep. */
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
    const result = await scanAllDispatchEvents()
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Dispatch event scan failed") },
      { status: 500 },
    )
  }
}
