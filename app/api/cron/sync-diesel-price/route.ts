import { NextResponse } from "next/server"
import { syncCurrentDieselPrice } from "@/app/actions/fuel-surcharge"
import { errorMessage } from "@/lib/error-message"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncCurrentDieselPrice()
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 })
  }
}

