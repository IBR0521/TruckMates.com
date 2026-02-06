import { NextRequest, NextResponse } from "next/server"
import { autoScheduleMaintenanceForAllTrucks } from "@/app/actions/auto-maintenance"

// Cron endpoint to auto-schedule maintenance for all trucks
// Can be called by Vercel Cron or external cron service
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await autoScheduleMaintenanceForAllTrucks()

    if (result.error) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Processed ${result.data?.trucks_processed || 0} trucks, scheduled ${result.data?.total_scheduled || 0} maintenance items`,
    })
  } catch (error: any) {
    console.error("Auto-maintenance cron error:", error)
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    )
  }
}




