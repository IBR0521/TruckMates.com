import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { dispatchMorningDigests } from "@/app/actions/notifications"
import { createAdminClient } from "@/lib/supabase/admin"
import { runCashFlowAlertBatch } from "@/lib/ai/agent/cash-flow-processor"

async function triggerCashFlowEvaluations() {
  try {
    const admin = createAdminClient()
    const summary = await runCashFlowAlertBatch(admin)
    if (summary.expiredPendingApprovals > 0) {
      console.info(
        `[cash_flow_alert] expired ${summary.expiredPendingApprovals} stale pending approval(s) from legacy AI path`,
      )
    }
  } catch (err) {
    console.error("[Agent]", err)
  }
}

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

    triggerCashFlowEvaluations().catch((err) => console.error("[Agent]", err))

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
