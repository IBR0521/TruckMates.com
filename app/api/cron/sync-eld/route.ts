import { NextResponse } from "next/server"
import { syncAllELDDevices } from "@/app/actions/eld-sync"

// This endpoint can be called by Vercel Cron or external cron service
// To set up in Vercel: Add to vercel.json or use Vercel Cron Jobs
export async function GET(request: Request) {
  // Verify request is from authorized source (optional but recommended)
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncAllELDDevices()

    if (result.error) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Synced ${result.data?.synced || 0} devices, ${result.data?.failed || 0} failed`
    })
  } catch (error: any) {
    console.error("Cron sync error:", error)
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    )
  }
}

