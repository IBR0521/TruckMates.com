import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { dispatchMorningDigests } from "@/app/actions/notifications"
import { createAdminClient } from "@/lib/supabase/admin"
import { runAgentEvaluation } from "@/lib/ai/agent/loop"

async function triggerCashFlowEvaluations() {
  try {
    const admin = createAdminClient()
    const { data: companies } = await admin.from("companies").select("id").limit(2000)
    for (const company of companies || []) {
      const companyId = String(company.id || "")
      if (!companyId) continue

      const [arRes, settlementsRes] = await Promise.all([
        admin
          .from("invoices")
          .select("amount")
          .eq("company_id", companyId)
          .not("status", "in", '("paid","cancelled","void")')
          .limit(10000),
        admin
          .from("settlements")
          .select("net_pay")
          .eq("company_id", companyId)
          .in("status", ["pending", "approved"])
          .limit(10000),
      ])

      const totalArOutstanding = (arRes.data || []).reduce((sum: number, invoice: any) => {
        return sum + Number(invoice.amount || 0)
      }, 0)
      const upcomingSettlementsTotal = (settlementsRes.data || []).reduce((sum: number, settlement: any) => {
        return sum + Number(settlement.net_pay || 0)
      }, 0)
      const configuredThreshold = 0
      const projectedCashPosition14Days = totalArOutstanding - upcomingSettlementsTotal

      runAgentEvaluation({
        companyId,
        trigger: "cash_flow_alert",
        triggerData: {
          projectedCashPosition14Days,
          totalArOutstanding,
          upcomingSettlementsTotal,
          configuredThreshold,
        },
        contextTypes: ["financial"],
      }).catch((err) => console.error("[Agent]", err))
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
