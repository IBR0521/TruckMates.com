"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { sanitizeError, errorMessage } from "@/lib/error-message"
import { buildInvoicePacketAttachments } from "@/lib/invoice-packet-build"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

type FactoringStatus = "pending" | "submitted" | "processing" | "funded" | "rejected" | "failed"

function normalizeFactoringStatus(raw: unknown): FactoringStatus {
  const value = String(raw || "").toLowerCase()
  if (["submitted", "processing", "funded", "rejected", "failed"].includes(value)) {
    return value as FactoringStatus
  }
  return "pending"
}

async function getTriumphConfig(companyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("company_settings")
    .select(`
      factoring_auto_submit,
      factoring_include_bol,
      factoring_include_rate_conf,
      factoring_include_pod,
      triumphpay_enabled,
      triumphpay_api_base_url,
      triumphpay_api_key,
      triumphpay_api_secret
    `)
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) return { data: null, error: safeDbError(error) }
  return { data, error: null }
}

function hasTriumphCredentials(cfg: Record<string, unknown> | null | undefined): boolean {
  return Boolean(
    cfg?.triumphpay_enabled &&
      cfg?.triumphpay_api_base_url &&
      cfg?.triumphpay_api_key &&
      cfg?.triumphpay_api_secret
  )
}

export async function maybeAutoSubmitFactoringApiOnInvoiceCreated(invoiceId: string) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: null, skipped: true as const }

  const configResult = await getTriumphConfig(ctx.companyId)
  if (configResult.error || !configResult.data) return { error: configResult.error || null, skipped: true as const }

  if (!configResult.data.factoring_auto_submit) return { error: null, skipped: true as const }
  if (!hasTriumphCredentials(configResult.data as Record<string, unknown>)) return { error: null, skipped: true as const }

  return submitInvoiceToTriumphPay(invoiceId)
}

export async function submitInvoiceToTriumphPay(invoiceId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const configResult = await getTriumphConfig(ctx.companyId)
  if (configResult.error || !configResult.data) return { error: configResult.error || "TriumphPay config not found", data: null }
  const config = configResult.data as Record<string, unknown>

  if (!hasTriumphCredentials(config)) {
    return { error: "TriumphPay is not configured. Set API base URL and credentials in Factoring settings.", data: null }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, issue_date, due_date, load_id")
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (invoiceError || !invoice) return { error: "Invoice not found", data: null }

  const packet = await buildInvoicePacketAttachments(
    supabase,
    ctx.companyId,
    invoiceId,
    {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      load_id: invoice.load_id as string | null,
    },
    {
      factoring_include_bol: config.factoring_include_bol !== false,
      factoring_include_rate_conf: config.factoring_include_rate_conf !== false,
      factoring_include_pod: config.factoring_include_pod !== false,
    }
  )
  if (packet.error) return { error: packet.error, data: null }

  const baseUrl = String(config.triumphpay_api_base_url).replace(/\/+$/, "")
  const apiKey = String(config.triumphpay_api_key || "")
  const apiSecret = String(config.triumphpay_api_secret || "")

  const payload = {
    invoice: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      amount: Number(invoice.amount || 0),
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      load_id: invoice.load_id || null,
    },
    documents: packet.attachments.map((a) => ({
      filename: a.filename,
      mime_type: "application/pdf",
      content_base64: a.content.toString("base64"),
    })),
  }

  let responseBody: any = null
  let responseStatus = 0
  try {
    const response = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-secret": apiSecret,
      },
      body: JSON.stringify(payload),
    })
    responseStatus = response.status
    responseBody = await response.json().catch(() => null)
  } catch (error: unknown) {
    Sentry.captureException(error)
    responseBody = { error: errorMessage(error, "TriumphPay request failed") }
  }

  const remoteStatus = normalizeFactoringStatus(responseBody?.status || (responseStatus >= 200 && responseStatus < 300 ? "submitted" : "failed"))
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      factoring_provider: "triumphpay",
      factoring_external_id: responseBody?.id || responseBody?.submission_id || null,
      factoring_reference_number: responseBody?.reference_number || null,
      factoring_status: remoteStatus,
      factoring_status_reason: responseBody?.reason || responseBody?.error || null,
      factoring_submitted_at: now,
      factoring_last_checked_at: now,
      factoring_funded_at: remoteStatus === "funded" ? now : null,
      factoring_funded_amount:
        remoteStatus === "funded"
          ? Number(responseBody?.funded_amount || responseBody?.fundedAmount || invoice.amount || 0)
          : null,
    })
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)

  if (updateError) return { error: safeDbError(updateError), data: null }

  revalidatePath("/dashboard/accounting/invoices")
  revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

  if (responseStatus < 200 || responseStatus >= 300) {
    return { error: `TriumphPay submission failed (${responseStatus || "no response"})`, data: null }
  }

  return {
    data: {
      submitted: true,
      status: remoteStatus,
      external_id: responseBody?.id || responseBody?.submission_id || null,
      reference_number: responseBody?.reference_number || null,
    },
    error: null,
  }
}

export async function syncInvoiceFactoringStatus(invoiceId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const configResult = await getTriumphConfig(ctx.companyId)
  if (configResult.error || !configResult.data) return { error: configResult.error || "TriumphPay config not found", data: null }
  const config = configResult.data as Record<string, unknown>

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, amount, factoring_external_id, factoring_status")
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()
  if (invoiceError || !invoice) return { error: "Invoice not found", data: null }
  if (!invoice.factoring_external_id) return { error: "Invoice has no factoring external ID", data: null }

  const baseUrl = String(config.triumphpay_api_base_url || "").replace(/\/+$/, "")
  const apiKey = String(config.triumphpay_api_key || "")
  const apiSecret = String(config.triumphpay_api_secret || "")

  let responseBody: any = null
  let responseStatus = 0
  try {
    const response = await fetch(`${baseUrl}/invoices/${encodeURIComponent(String(invoice.factoring_external_id))}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-api-secret": apiSecret,
      },
    })
    responseStatus = response.status
    responseBody = await response.json().catch(() => null)
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to poll factoring status"), data: null }
  }

  if (responseStatus < 200 || responseStatus >= 300) {
    return { error: `TriumphPay polling failed (${responseStatus})`, data: null }
  }

  const nextStatus = normalizeFactoringStatus(responseBody?.status || invoice.factoring_status)
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      factoring_status: nextStatus,
      factoring_status_reason: responseBody?.reason || responseBody?.error || null,
      factoring_reference_number: responseBody?.reference_number || null,
      factoring_last_checked_at: now,
      factoring_funded_at: nextStatus === "funded" ? now : null,
      factoring_funded_amount:
        nextStatus === "funded"
          ? Number(responseBody?.funded_amount || responseBody?.fundedAmount || invoice.amount || 0)
          : null,
    })
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
  if (updateError) return { error: safeDbError(updateError), data: null }

  revalidatePath("/dashboard/accounting/invoices")
  revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)
  return { data: { status: nextStatus }, error: null }
}

export async function syncAllPendingFactoringStatuses() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()

  // Cron path: iterate all companies that have Triumph enabled.
  if (ctx.error || !ctx.companyId) {
    const admin = await import("@/lib/supabase/admin")
    const adminClient = admin.createAdminClient()
    const { data: companies, error } = await adminClient
      .from("company_settings")
      .select("company_id")
      .eq("triumphpay_enabled", true)
      .not("triumphpay_api_base_url", "is", null)
      .not("triumphpay_api_key", "is", null)
      .not("triumphpay_api_secret", "is", null)

    if (error) return { error: safeDbError(error), data: null }

    let processed = 0
    for (const row of companies || []) {
      const companyId = String((row as { company_id?: string }).company_id || "")
      if (!companyId) continue

      const { data: invoices } = await adminClient
        .from("invoices")
        .select("id")
        .eq("company_id", companyId)
        .eq("factoring_provider", "triumphpay")
        .in("factoring_status", ["pending", "submitted", "processing"])
        .not("factoring_external_id", "is", null)
        .limit(200)

      for (const inv of invoices || []) {
        const invoiceId = String((inv as { id?: string }).id || "")
        if (!invoiceId) continue
        await syncFactoringStatusForCompany(companyId, invoiceId)
        processed += 1
      }
    }
    return { data: { processed }, error: null }
  }

  // Interactive path: sync for current company only.
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("factoring_provider", "triumphpay")
    .in("factoring_status", ["pending", "submitted", "processing"])
    .not("factoring_external_id", "is", null)
    .limit(200)
  if (error) return { error: safeDbError(error), data: null }

  let processed = 0
  for (const inv of invoices || []) {
    const invoiceId = String((inv as { id?: string }).id || "")
    if (!invoiceId) continue
    const result = await syncInvoiceFactoringStatus(invoiceId)
    if (!result.error) processed += 1
  }

  return { data: { processed }, error: null }
}

async function syncFactoringStatusForCompany(companyId: string, invoiceId: string) {
  const admin = await import("@/lib/supabase/admin")
  const adminClient = admin.createAdminClient()

  const { data: config } = await adminClient
    .from("company_settings")
    .select("triumphpay_api_base_url, triumphpay_api_key, triumphpay_api_secret")
    .eq("company_id", companyId)
    .maybeSingle()
  if (!config?.triumphpay_api_base_url || !config?.triumphpay_api_key || !config?.triumphpay_api_secret) return

  const { data: invoice } = await adminClient
    .from("invoices")
    .select("id, amount, factoring_external_id, factoring_status")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle()
  if (!invoice?.factoring_external_id) return

  const baseUrl = String(config.triumphpay_api_base_url).replace(/\/+$/, "")
  const response = await fetch(`${baseUrl}/invoices/${encodeURIComponent(String(invoice.factoring_external_id))}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${String(config.triumphpay_api_key)}`,
      "x-api-secret": String(config.triumphpay_api_secret),
    },
  }).catch(() => null)
  if (!response || !response.ok) return

  const body = await response.json().catch(() => null)
  const status = normalizeFactoringStatus(body?.status || invoice.factoring_status)
  const now = new Date().toISOString()
  await adminClient
    .from("invoices")
    .update({
      factoring_status: status,
      factoring_status_reason: body?.reason || body?.error || null,
      factoring_reference_number: body?.reference_number || null,
      factoring_last_checked_at: now,
      factoring_funded_at: status === "funded" ? now : null,
      factoring_funded_amount:
        status === "funded"
          ? Number(body?.funded_amount || body?.fundedAmount || invoice.amount || 0)
          : null,
    })
    .eq("id", invoiceId)
    .eq("company_id", companyId)
}
