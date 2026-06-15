import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { scanAllDeliveryDelays } from "@/app/actions/delivery-delay-notify"

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
    const result = await scanAllDeliveryDelays()
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(err, "Delivery delay scan failed") },
      { status: 500 },
    )
  }
}
