"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { getCompanySettings } from "./number-formats"
import { getResendClient } from "./invoice-email"
import { buildInvoicePacketAttachments, buildInvoicePacketEmailContent } from "@/lib/invoice-packet-build"

type Attachment = { filename: string; content: Buffer }

/**
 * After invoice creation, auto-submit to factoring if enabled in company settings.
 */
export async function maybeAutoSubmitFactoringOnInvoiceCreated(invoiceId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: null, skipped: true as const }
  }

  const { data: settings } = await supabase
    .from("company_settings")
    .select("factoring_auto_submit, factoring_submission_email")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (
    !settings?.factoring_auto_submit ||
    !settings.factoring_submission_email ||
    !String(settings.factoring_submission_email).includes("@")
  ) {
    return { error: null, skipped: true as const }
  }

  return sendInvoiceToFactoring(invoiceId)
}

/**
 * Send invoice packet (PDF + optional BOL / rate conf / POD) to the factoring company email.
 */
export async function sendInvoiceToFactoring(invoiceId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { checkApiUsage } = await import("@/lib/api-protection")
    const rateCheck = await checkApiUsage("resend", "send_email")
    if (!rateCheck.allowed) {
      return { error: rateCheck.reason || "Email rate limit exceeded.", data: null }
    }
  } catch {
    return { error: "Rate limit check failed. Please try again later.", data: null }
  }

  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || ({} as Record<string, unknown>)
  const submissionEmail = String(settings.factoring_submission_email || "").trim()
  if (!submissionEmail.includes("@")) {
    return {
      error: "Configure factoring submission email in Settings → Factoring.",
      data: null,
    }
  }

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, load_id, description")
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (invErr || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name, email")
    .eq("id", ctx.companyId)
    .maybeSingle()

  const companyName = company?.name || "Company"
  let loadNumber = "—"
  let loadCustomer: string | null = null
  if (invoice.load_id) {
    const { data: loadRow } = await supabase
      .from("loads")
      .select("shipment_number, company_name")
      .eq("id", invoice.load_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (loadRow?.shipment_number) loadNumber = loadRow.shipment_number
    loadCustomer = loadRow?.company_name || null
  }
  const customerName = invoice.customer_name || loadCustomer || "Customer"
  const amountStr = `$${Number(invoice.amount || 0).toFixed(2)}`

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
      factoring_include_bol: settings.factoring_include_bol !== false,
      factoring_include_rate_conf: settings.factoring_include_rate_conf !== false,
      factoring_include_pod: settings.factoring_include_pod !== false,
    },
  )

  if (packet.error) {
    return {
      error: packet.error.includes("invoice PDF")
        ? `${packet.error} Check Puppeteer / server PDF support.`
        : packet.error,
      data: null,
    }
  }

  const attachments: Attachment[] = packet.attachments
  const { subject, bodyText, bodyHtml } = buildInvoicePacketEmailContent({
    settings,
    invoiceNumber: invoice.invoice_number || invoice.id,
    companyName,
    loadNumber,
    customerName,
    amountStr,
    docLines: packet.docLines,
  })

  const resend = await getResendClient()
  if (!resend) {
    return {
      error:
        "Email service not configured. Add RESEND_API_KEY to the server environment or save your API key under Settings → Integration.",
      data: null,
    }
  }

  let fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail && ctx.companyId) {
    const { data: integrations } = await supabase
      .from("company_integrations")
      .select("resend_from_email")
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (integrations?.resend_from_email) fromEmail = integrations.resend_from_email
  }
  fromEmail = fromEmail || "onboarding@resend.dev"

  const emailResult = await resend.emails.send({
    from: fromEmail,
    to: [submissionEmail],
    subject,
    html: bodyHtml,
    text: bodyText,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  })

  if (emailResult.error) {
    return {
      error: `Failed to send: ${emailResult.error.message || "Unknown error"}`,
      data: null,
    }
  }

  const now = new Date().toISOString()
  await supabase
    .from("invoices")
    .update({
      factoring_status: "pending",
      factoring_submitted_at: now,
    })
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)

  revalidatePath("/dashboard/accounting/invoices")
  revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

  return {
    data: {
      sent: true,
      to: submissionEmail,
      attachmentCount: attachments.length,
      emailId: emailResult.data?.id,
    },
    error: null,
  }
}

/** Mark invoice as funded by factoring company (manual dispatcher update). */
export async function markInvoiceFactoringFunded(invoiceId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("invoices")
    .update({
      factoring_status: "funded",
      factoring_funded_at: now,
    })
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)

  if (error) return { error: error.message, data: null }

  revalidatePath("/dashboard/accounting/invoices")
  revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)
  return { data: { success: true }, error: null }
}
