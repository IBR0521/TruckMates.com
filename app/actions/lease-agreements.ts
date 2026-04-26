"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { sanitizeError } from "@/lib/error-message"
import { checkCreatePermission, checkViewPermission } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

export async function createLeaseAgreement(input: {
  driver_id: string
  truck_id?: string
  lease_type: "lease-to-own" | "straight_lease"
  total_amount: number
  weekly_payment: number
  start_date: string
  end_date?: string
}) {
  const permission = await checkCreatePermission("settlements")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("lease_agreements")
    .insert({
      company_id: ctx.companyId,
      driver_id: input.driver_id,
      truck_id: input.truck_id || null,
      lease_type: input.lease_type,
      total_amount: input.total_amount,
      weekly_payment: input.weekly_payment,
      start_date: input.start_date,
      end_date: input.end_date || null,
      remaining_balance: input.total_amount,
      is_active: true,
    })
    .select("*")
    .single()

  if (error) return { error: safeDbError(error), data: null }
  revalidatePath(`/dashboard/drivers/${input.driver_id}`)
  return { data, error: null }
}

export async function getActiveLeaseAgreement(driverId: string) {
  const permission = await checkViewPermission("settlements")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const today = new Date().toISOString().split("T")[0]
  const { data, error } = await supabase
    .from("lease_agreements")
    .select("id, driver_id, truck_id, lease_type, total_amount, weekly_payment, start_date, end_date, remaining_balance, is_active")
    .eq("company_id", ctx.companyId)
    .eq("driver_id", driverId)
    .eq("is_active", true)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { error: safeDbError(error), data: null }
  return { data, error: null }
}

export async function getLeasePaymentHistory(driverId: string) {
  const permission = await checkViewPermission("settlements")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data: lease } = await supabase
    .from("lease_agreements")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lease?.id) return { data: [], error: null }

  const { data, error } = await supabase
    .from("lease_payments")
    .select("id, settlement_id, payment_date, amount, remaining_balance_after, created_at")
    .eq("company_id", ctx.companyId)
    .eq("lease_agreement_id", lease.id)
    .order("payment_date", { ascending: false })
    .limit(100)

  if (error) return { error: safeDbError(error), data: null }
  return { data: data || [], error: null }
}
