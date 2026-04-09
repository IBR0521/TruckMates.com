import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { dispatchMorningDigests } from "@/app/actions/notifications"

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
    const result = await dispatchMorningDigests()
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Morning digests sent: ${result.data?.sent || 0}`,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Morning digest dispatch failed") },
      { status: 500 },
    )
  }
}
