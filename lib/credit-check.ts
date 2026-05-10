import { createAdminClient } from "@/lib/supabase/admin"
import { runAgentEvaluation } from "@/lib/ai/agent/loop"
import { mapLegacyRole } from "@/lib/roles"

export type CreditOverrideResourceType = "load" | "invoice"

export type DeferredCreditOverrideAudit = {
  companyId: string
  userId: string | null
  customerId: string
  customerName: string
  resourceType: CreditOverrideResourceType
  currentAR: number
  creditLimit: number
  attemptedLoadValue: number
  overageAmount: number
}

export type CustomerCreditGateResult =
  | { allowed: true; deferredOverrideAudit?: DeferredCreditOverrideAudit }
  | { allowed: false; error: string }

const LOAD_CREDIT_ERROR =
  "Customer is over credit limit. Manager approval required to create this load. Please contact your operations manager."

const INVOICE_CREDIT_ERROR =
  "Customer is over credit limit. Manager approval required to create this invoice. Please contact your operations manager."

export function canOverrideCustomerCreditLimit(userRole: string | null | undefined): boolean {
  const raw = String(userRole || "").trim().toLowerCase()
  if (raw === "admin" || raw === "owner") return true
  const mapped = mapLegacyRole(userRole)
  return mapped === "super_admin" || mapped === "operations_manager"
}

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
    const r = row as { amount?: unknown; paid_amount?: unknown }
    const amt = Number(r.amount || 0)
    const paid = Number(r.paid_amount || 0)
    sum += Math.max(0, amt - paid)
  }
  return sum
}

export async function insertCreditLimitOverrideAudit(
  payload: DeferredCreditOverrideAudit & { resourceId: string },
): Promise<void> {
  const admin = createAdminClient()
  await admin.from("audit_logs").insert({
    company_id: payload.companyId,
    user_id: payload.userId || null,
    action: "credit_limit_override",
    resource_type: payload.resourceType,
    resource_id: payload.resourceId,
    details: {
      customerId: payload.customerId,
      customerName: payload.customerName,
      currentAR: payload.currentAR,
      creditLimit: payload.creditLimit,
      attemptedLoadValue: payload.attemptedLoadValue,
      overageAmount: payload.overageAmount,
    },
  } as never)
}

export async function evaluateCustomerCreditGate(params: {
  companyId: string
  customerId: string
  customerName: string
  additionalAmount: number
  userRole: string | null | undefined
  userId?: string | null
  /** When set and manager overrides, audit is deferred until resource id exists (load / invoice). */
  overrideResourceType?: CreditOverrideResourceType
}): Promise<CustomerCreditGateResult> {
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

  const customerName = params.customerName || String(row?.name || "Customer")
  const overageAmount = projected - limit
  const creditError =
    params.overrideResourceType === "invoice" ? INVOICE_CREDIT_ERROR : LOAD_CREDIT_ERROR

  if (canOverrideCustomerCreditLimit(params.userRole)) {
    if (params.overrideResourceType) {
      return {
        allowed: true,
        deferredOverrideAudit: {
          companyId: params.companyId,
          userId: params.userId ?? null,
          customerId: params.customerId,
          customerName,
          resourceType: params.overrideResourceType,
          currentAR: ar,
          creditLimit: limit,
          attemptedLoadValue: params.additionalAmount,
          overageAmount,
        },
      }
    }

    await admin.from("audit_logs").insert({
      company_id: params.companyId,
      user_id: params.userId || null,
      action: "credit_limit_override",
      resource_type: "customer",
      resource_id: params.customerId,
      details: {
        customerId: params.customerId,
        customerName,
        currentAR: ar,
        creditLimit: limit,
        attemptedLoadValue: params.additionalAmount,
        overageAmount,
      },
    } as never)
    return { allowed: true }
  }

  void runAgentEvaluation({
    companyId: params.companyId,
    trigger: "credit_hold",
    triggerData: {
      customerId: params.customerId,
      customerName,
      currentAR: ar,
      creditLimit: limit,
      attemptedLoadValue: params.additionalAmount,
      requestedBy: params.userId ?? null,
      resourceType: params.overrideResourceType ?? "customer",
    },
    contextTypes: ["financial"],
  }).catch((err) => console.error("[credit-hold]", err))

  return { allowed: false, error: creditError }
}
