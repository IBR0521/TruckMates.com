import { createAdminClient } from "@/lib/supabase/admin"
import { runAgentEvaluation } from "@/lib/ai/agent/loop"
import { mapLegacyRole } from "@/lib/roles"

export const CREDIT_OVERRIDE_ROLES = new Set(["super_admin", "owner", "operations_manager", "admin"])

export async function sumOutstandingArForCustomer(companyId: string, customerId: string): Promise<number> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("invoices")
    .select("amount, paid_amount, status")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .not("status", "in", '("paid","cancelled","void")')
    .limit(5000)

  let sum = 0
  for (const row of rows || []) {
    const r = row as { amount?: unknown; paid_amount?: unknown; status?: string }
    const amt = Number(r.amount || 0)
    const paid = Number(r.paid_amount || 0)
    sum += Math.max(0, amt - paid)
  }
  return sum
}

export async function evaluateCustomerCreditGate(params: {
  companyId: string
  customerId: string
  customerName: string
  additionalAmount: number
  userRole: string | null | undefined
  userId?: string | null
  auditAction: string
  overrideAuditMessage?: string
}): Promise<{ allowed: boolean; error?: string }> {
  if (!params.customerId || params.additionalAmount <= 0) {
    return { allowed: true }
  }

  const admin = createAdminClient()
  const { data: cust } = await admin
    .from("customers")
    .select("id, credit_limit, name")
    .eq("id", params.customerId)
    .eq("company_id", params.companyId)
    .maybeSingle()

  const row = cust as { credit_limit?: number | null; name?: string | null } | null
  const limit = Number(row?.credit_limit ?? 0)
  if (!limit || limit <= 0) {
    return { allowed: true }
  }

  const ar = await sumOutstandingArForCustomer(params.companyId, params.customerId)
  const projected = ar + params.additionalAmount
  if (projected <= limit) {
    return { allowed: true }
  }

  const role = mapLegacyRole(params.userRole || "")
  const normalized = String(params.userRole || "").toLowerCase()
  const canOverride =
    CREDIT_OVERRIDE_ROLES.has(role) ||
    CREDIT_OVERRIDE_ROLES.has(normalized) ||
    normalized.includes("admin") ||
    normalized === "super_admin"

  if (canOverride) {
    await admin.from("audit_logs").insert({
      company_id: params.companyId,
      user_id: params.userId || null,
      action: params.auditAction,
      resource_type: "customer",
      resource_id: params.customerId,
      details: {
        message: params.overrideAuditMessage || "Approved over credit limit",
        credit_limit: limit,
        outstanding_ar: ar,
        attempted: params.additionalAmount,
      },
    } as never)
    return { allowed: true }
  }

  void runAgentEvaluation({
    companyId: params.companyId,
    trigger: "credit_hold",
    triggerData: {
      customerId: params.customerId,
      customerName: params.customerName || row?.name || "Customer",
      currentAR: ar,
      creditLimit: limit,
      attemptedLoadValue: params.additionalAmount,
    },
    contextTypes: ["financial"],
  }).catch(() => {})

  return {
    allowed: false,
    error: "Customer at credit limit. Manager approval required.",
  }
}
