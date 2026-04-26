"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkCreatePermission, checkViewPermission } from "@/lib/server-permissions"
import { sanitizeString } from "@/lib/validation"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

type GLAccountType = "asset" | "liability" | "revenue" | "expense"

const DEFAULT_TRUCKING_GL: Array<{ code: string; name: string; type: GLAccountType }> = [
  { code: "1000", name: "Cash - Operating", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1500", name: "Prepaid Insurance", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Accrued Expenses", type: "liability" },
  { code: "2200", name: "Fuel Card Payable", type: "liability" },
  { code: "4000", name: "Freight Revenue", type: "revenue" },
  { code: "4010", name: "Detention Revenue", type: "revenue" },
  { code: "4020", name: "Accessorial Revenue", type: "revenue" },
  { code: "5000", name: "Fuel & Oil Expense", type: "expense" },
  { code: "5100", name: "Maintenance & Repairs", type: "expense" },
  { code: "5200", name: "Driver Pay", type: "expense" },
  { code: "5300", name: "Insurance Expense", type: "expense" },
  { code: "5400", name: "Permits & Compliance", type: "expense" },
  { code: "5500", name: "Tires & Parts", type: "expense" },
  { code: "5600", name: "Tolls & Scale Fees", type: "expense" },
  { code: "5700", name: "Depreciation Expense", type: "expense" },
]

export async function getGLAccounts(type?: GLAccountType) {
  const permission = await checkViewPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view GL accounts", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    let query = supabase
      .from("gl_accounts")
      .select("id, code, name, type")
      .eq("company_id", ctx.companyId)
      .order("code", { ascending: true })
      .limit(500)

    if (type) query = query.eq("type", type)

    const { data, error } = await query
    if (error) return { error: safeDbError(error), data: null }
    return { data: data || [], error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load GL accounts"), data: null }
  }
}

export async function ensureDefaultGLAccounts(companyId?: string) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    const cid = companyId || ctx.companyId
    if (!cid) return { error: "No company found", created: 0 }

    const rows = DEFAULT_TRUCKING_GL.map((acc) => ({
      company_id: cid,
      code: acc.code,
      name: acc.name,
      type: acc.type,
    }))

    const { error } = await supabase
      .from("gl_accounts")
      .upsert(rows, { onConflict: "company_id,code", ignoreDuplicates: true })

    if (error) return { error: safeDbError(error), created: 0 }
    return { error: null, created: rows.length }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to seed default GL accounts"), created: 0 }
  }
}

export async function createGLAccount(input: { code: string; name: string; type: GLAccountType }) {
  const permission = await checkCreatePermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to create GL accounts", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const payload = {
      company_id: ctx.companyId,
      code: sanitizeString(input.code, 40).trim(),
      name: sanitizeString(input.name, 120).trim(),
      type: input.type,
    }
    if (!payload.code || !payload.name) {
      return { error: "Code and name are required", data: null }
    }

    const { data, error } = await supabase
      .from("gl_accounts")
      .insert(payload)
      .select("id, code, name, type")
      .single()

    if (error) return { error: safeDbError(error), data: null }
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create GL account"), data: null }
  }
}
