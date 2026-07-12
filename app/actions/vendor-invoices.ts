"use server"

import { safeDbError } from "@/lib/utils/error"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"
import { sanitizeString, sanitizeForOr } from "@/lib/validation"
import { fetchAllRowsByIdCursor } from "@/lib/supabase/fetch-all-by-id-cursor"
export type VendorInvoiceStatus = "draft" | "approved" | "paid" | "overdue"
type APAgingBucketKey = "0-30" | "31-60" | "61-90" | "90+"

type VendorInvoiceRow = {
  id: string
  company_id: string
  vendor_id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  amount: number
  status: VendorInvoiceStatus
  payment_method: string | null
  paid_date: string | null
  gl_code: string | null
  created_at: string
  vendors?: { id: string; name: string | null; company_name: string | null } | null
}

function normalizeStatus(status: unknown): VendorInvoiceStatus {
  const s = String(status || "").toLowerCase()
  if (s === "approved" || s === "paid" || s === "overdue") return s
  return "draft"
}

function getAgingBucket(daysOutstanding: number): APAgingBucketKey {
  if (daysOutstanding <= 30) return "0-30"
  if (daysOutstanding <= 60) return "31-60"
  if (daysOutstanding <= 90) return "61-90"
  return "90+"
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export async function getVendorInvoices(filters?: {
  status?: VendorInvoiceStatus
  vendor_id?: string
  search?: string
  limit?: number
  offset?: number
  keyset?: boolean
  cursor?: string
}) {
  const permission = await checkViewPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view payables", data: null, count: 0 }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null, count: 0 }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const mapRows = (rows: VendorInvoiceRow[]) =>
      rows.map((row) => {
        const due = row.due_date ? new Date(row.due_date) : null
        const isOverdue = !!due && due.getTime() < today.getTime() && normalizeStatus(row.status) !== "paid"
        return {
          ...row,
          status: isOverdue ? "overdue" : normalizeStatus(row.status),
        }
      })

    if (filters?.keyset === true) {
      const limit = Math.min(filters?.limit ?? 50, 100)
      let q = supabase
        .from("vendor_invoices")
        .select(`
        id, company_id, vendor_id, invoice_number, invoice_date, due_date, amount, status,
        payment_method, paid_date, gl_code, created_at,
        vendors:vendor_id ( id, name, company_name )
      `)
        .eq("company_id", ctx.companyId)
        .order("id", { ascending: false })
        .limit(limit + 1)

      if (filters?.status) q = q.eq("status", filters.status)
      if (filters?.vendor_id) q = q.eq("vendor_id", filters.vendor_id)
      if (filters?.search) {
        const s = sanitizeForOr(sanitizeString(filters.search, 120))
        if (s.length > 0) {
          q = q.or(`invoice_number.ilike.%${s}%,gl_code.ilike.%${s}%`)
        }
      }
      if (filters?.cursor) {
        q = q.lt("id", filters.cursor)
      }

      const { data, error } = await q
      if (error) return { error: safeDbError(error), data: null, count: 0 }
      const raw = (data || []) as VendorInvoiceRow[]
      const hasMore = raw.length > limit
      const slice = hasMore ? raw.slice(0, limit) : raw
      const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null
      return { data: mapRows(slice), error: null, count: slice.length, nextCursor }
    }

    let query = supabase
      .from("vendor_invoices")
      .select(`
        id, company_id, vendor_id, invoice_number, invoice_date, due_date, amount, status,
        payment_method, paid_date, gl_code, created_at,
        vendors:vendor_id ( id, name, company_name )
      `, { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("due_date", { ascending: true })

    if (filters?.status) query = query.eq("status", filters.status)
    if (filters?.vendor_id) query = query.eq("vendor_id", filters.vendor_id)

    if (filters?.search) {
      const q = sanitizeForOr(sanitizeString(filters.search, 120))
      if (q.length > 0) {
        query = query.or(`invoice_number.ilike.%${q}%,gl_code.ilike.%${q}%`)
      }
    }

    const limit = Math.min(filters?.limit || 100, 500)
    const offset = filters?.offset || 0
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) return { error: safeDbError(error), data: null, count: 0 }

    const mapped = mapRows((data || []) as VendorInvoiceRow[])

    return { data: mapped, error: null, count: count || 0, nextCursor: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load vendor invoices"), data: null, count: 0 }
  }
}

export async function createVendorInvoice(input: {
  vendor_id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  amount: number
  status?: VendorInvoiceStatus
  gl_code?: string | null
}) {
  const permission = await checkCreatePermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to create payables", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { requirePlanFeature } = await import("@/lib/plan-feature-guard")
    const planError = await requirePlanFeature(ctx.companyId, "ap_vendor_invoicing")
    if (planError) return { error: planError, data: null }

    const payload = {
      company_id: ctx.companyId,
      vendor_id: sanitizeString(input.vendor_id, 80),
      invoice_number: sanitizeString(input.invoice_number, 80).trim(),
      invoice_date: toDateOnly(input.invoice_date),
      due_date: toDateOnly(input.due_date),
      amount: Math.max(Number(input.amount || 0), 0),
      status: normalizeStatus(input.status),
      gl_code: sanitizeString(input.gl_code || "", 80) || null,
    }

    if (!payload.vendor_id || !payload.invoice_number || !payload.invoice_date || !payload.due_date) {
      return { error: "Vendor, invoice number, invoice date, and due date are required", data: null }
    }

    const { data, error } = await supabase
      .from("vendor_invoices")
      .insert(payload)
      .select("id, invoice_number")
      .single()

    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/payables/vendor-invoices")
    revalidatePath("/dashboard/payables/ap-aging")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create vendor invoice"), data: null }
  }
}

export async function markVendorInvoicePaid(input: {
  id: string
  payment_method: string
  paid_date: string
}) {
  const permission = await checkEditPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to edit payables", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const paidDate = toDateOnly(input.paid_date)
    if (!paidDate) return { error: "Paid date is required", data: null }

    const paymentMethod = sanitizeString(input.payment_method, 50).trim()
    if (!paymentMethod) return { error: "Payment method is required", data: null }

    const { data, error } = await supabase
      .from("vendor_invoices")
      .update({
        status: "paid",
        paid_date: paidDate,
        payment_method: paymentMethod,
      })
      .eq("id", input.id)
      .eq("company_id", ctx.companyId)
      .select("id, status, payment_method, paid_date")
      .single()

    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/payables/vendor-invoices")
    revalidatePath("/dashboard/payables/ap-aging")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to mark invoice as paid"), data: null }
  }
}

export async function deleteVendorInvoice(id: string) {
  const permission = await checkDeletePermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to delete payables", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { error } = await supabase
      .from("vendor_invoices")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/payables/vendor-invoices")
    revalidatePath("/dashboard/payables/ap-aging")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete vendor invoice"), data: null }
  }
}

export async function getAPAgingReport() {
  const permission = await checkViewPermission("accounting")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view payables", data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { rows: data, error: apFetchError } = await fetchAllRowsByIdCursor<{
      id: string
      vendor_id: string
      invoice_number: string | null
      due_date: string
      amount: number | null
      status: string
      vendors?: { name?: string | null; company_name?: string | null } | null
    }>(
      async ({ lastId, pageSize }) => {
        let q = supabase
          .from("vendor_invoices")
          .select(`
        id, vendor_id, invoice_number, due_date, amount, status,
        vendors:vendor_id ( name, company_name )
      `)
          .eq("company_id", ctx.companyId)
          .neq("status", "paid")
          .order("id", { ascending: true })
          .limit(pageSize)
        if (lastId) q = q.gt("id", lastId)
        return await q
      },
      { warnLabel: "AP aging vendor_invoices" },
    )

    if (apFetchError) return { error: safeDbError(new Error(apFetchError), "Failed to load AP aging"), data: null }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const buckets: Record<APAgingBucketKey, {
      key: APAgingBucketKey
      label: string
      total_outstanding: number
      invoice_count: number
      vendors: Array<{
        vendor_name: string
        total_outstanding: number
        invoice_count: number
        invoices: Array<{ id: string; invoice_number: string; due_date: string; days_outstanding: number; outstanding_amount: number }>
      }>
      invoices: Array<{ id: string; invoice_number: string; due_date: string; days_outstanding: number; outstanding_amount: number; vendor_name: string }>
    }> = {
      "0-30": { key: "0-30", label: "0-30 days", total_outstanding: 0, invoice_count: 0, vendors: [], invoices: [] },
      "31-60": { key: "31-60", label: "31-60 days", total_outstanding: 0, invoice_count: 0, vendors: [], invoices: [] },
      "61-90": { key: "61-90", label: "61-90 days", total_outstanding: 0, invoice_count: 0, vendors: [], invoices: [] },
      "90+": { key: "90+", label: "90+ days", total_outstanding: 0, invoice_count: 0, vendors: [], invoices: [] },
    }

    for (const row of (data || []) as Array<VendorInvoiceRow & { vendors?: { name?: string | null; company_name?: string | null } | null }>) {
      const due = row.due_date ? new Date(row.due_date) : null
      if (!due || Number.isNaN(due.getTime())) continue
      const amount = Math.max(Number(row.amount || 0), 0)
      if (amount <= 0) continue
      due.setHours(0, 0, 0, 0)

      const msDiff = now.getTime() - due.getTime()
      const daysOutstanding = msDiff > 0 ? Math.floor(msDiff / (1000 * 60 * 60 * 24)) : 0
      const key = getAgingBucket(daysOutstanding)
      const vendorName = row.vendors?.company_name || row.vendors?.name || "Unknown Vendor"

      buckets[key].invoices.push({
        id: row.id,
        invoice_number: row.invoice_number || row.id,
        due_date: row.due_date,
        days_outstanding: daysOutstanding,
        outstanding_amount: amount,
        vendor_name: vendorName,
      })
    }

    const ordered = (["0-30", "31-60", "61-90", "90+"] as const).map((key) => {
      const bucket = buckets[key]
      const vendorMap = new Map<string, {
        vendor_name: string
        total_outstanding: number
        invoice_count: number
        invoices: Array<{ id: string; invoice_number: string; due_date: string; days_outstanding: number; outstanding_amount: number }>
      }>()

      for (const inv of bucket.invoices) {
        const existing = vendorMap.get(inv.vendor_name)
        if (existing) {
          existing.total_outstanding += inv.outstanding_amount
          existing.invoice_count += 1
          existing.invoices.push({
            id: inv.id,
            invoice_number: inv.invoice_number,
            due_date: inv.due_date,
            days_outstanding: inv.days_outstanding,
            outstanding_amount: inv.outstanding_amount,
          })
        } else {
          vendorMap.set(inv.vendor_name, {
            vendor_name: inv.vendor_name,
            total_outstanding: inv.outstanding_amount,
            invoice_count: 1,
            invoices: [{
              id: inv.id,
              invoice_number: inv.invoice_number,
              due_date: inv.due_date,
              days_outstanding: inv.days_outstanding,
              outstanding_amount: inv.outstanding_amount,
            }],
          })
        }
      }

      const vendors = Array.from(vendorMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding)
      const total = bucket.invoices.reduce((sum, inv) => sum + inv.outstanding_amount, 0)
      return {
        ...bucket,
        vendors,
        total_outstanding: total,
        invoice_count: bucket.invoices.length,
      }
    })

    const totals = {
      total_outstanding: ordered.reduce((sum, b) => sum + b.total_outstanding, 0),
      total_invoices: ordered.reduce((sum, b) => sum + b.invoice_count, 0),
    }

    return { data: { buckets: ordered, totals }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to build AP aging report"), data: null }
  }
}
