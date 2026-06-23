import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCashFlowProjectionThreshold, type CashFlowTriggerMetrics } from "@/lib/ai/agent/cash-flow-gate"

type AmountRow = { amount: number | string | null }
type SettlementRow = { net_pay: number | string | null }

export type CashFlowTriggerPayload = CashFlowTriggerMetrics & {
  configuredThreshold: number
}

/** Gather cash-flow trigger metrics for a company (same queries as morning-digest cron). */
export async function gatherCashFlowTriggerData(
  admin: SupabaseClient,
  companyId: string,
  automationConfig?: Record<string, unknown> | null,
): Promise<CashFlowTriggerPayload> {
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

  const totalArOutstanding = ((arRes.data || []) as AmountRow[]).reduce((sum: number, invoice) => {
    return sum + Number(invoice.amount || 0)
  }, 0)
  const upcomingSettlementsTotal = ((settlementsRes.data || []) as SettlementRow[]).reduce(
    (sum: number, settlement) => sum + Number(settlement.net_pay || 0),
    0,
  )
  const projectedCashPosition14Days = totalArOutstanding - upcomingSettlementsTotal
  const configuredThreshold = resolveCashFlowProjectionThreshold(automationConfig)

  return {
    projectedCashPosition14Days,
    totalArOutstanding,
    upcomingSettlementsTotal,
    configuredThreshold,
  }
}
