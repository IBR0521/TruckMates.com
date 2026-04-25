import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { processAlertEscalations } from "@/app/actions/alerts"
import { processComplianceRegistrationExpiryAlerts } from "@/app/actions/compliance-registrations"

// Cron endpoint to process alert escalations
// Runs every 5 minutes to check for overdue alerts and escalate them
// Can be called by Vercel Cron or external cron service
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // SECURITY: Fail-closed - require CRON_SECRET if set
  if (!cronSecret) {
    console.error("[Cron Alert Escalations] CRON_SECRET not configured - endpoint disabled")
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [result, complianceResult] = await Promise.all([
      processAlertEscalations(),
      processComplianceRegistrationExpiryAlerts(),
    ])

    if (result.error) {
      console.error("[Cron Alert Escalations] Error:", result.error)
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 500 }
      )
    }
    if (complianceResult.error) {
      console.error("[Cron Alert Escalations] Compliance expiry error:", complianceResult.error)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.data,
        compliance_alerts_created: complianceResult.data?.alerts_created || 0,
      },
      message: `Processed alert escalations: ${result.data?.escalated || 0} alerts escalated; compliance alerts created: ${complianceResult.data?.alerts_created || 0}`,
    })
  } catch (error: unknown) {
    console.error("[Cron Alert Escalations] Unexpected error:", error)
    return NextResponse.json(
      { error: errorMessage(error), success: false },
      { status: 500 }
    )
  }
}

