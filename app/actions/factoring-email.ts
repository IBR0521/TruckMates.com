"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { getCompanySettings } from "./number-formats"
import { getResendClient } from "./invoice-email"
import { generateInvoicePdfBuffer } from "./invoice-pdf"
import { generateBOLPDFFile } from "./bol-pdf"
import { escapeHtml } from "@/lib/html-escape"

type Attachment = { filename: string; content: Buffer }

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "attachment"
}

async function downloadStoragePath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileUrl: string,
): Promise<{ buffer: Buffer | null; error: string | null }> {
  let path = fileUrl.trim()
  const m = path.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/([^?]+)/)
  if (m) {
    path = decodeURIComponent(m[1])
  } else if (path.startsWith("http")) {
    try {
      const res = await fetch(path)
      if (!res.ok) return { buffer: null, error: `HTTP ${res.status}` }
      const ab = await res.arrayBuffer()
      return { buffer: Buffer.from(ab), error: null }
    } catch (e) {
      return { buffer: null, error: e instanceof Error ? e.message : "Fetch failed" }
    }
  }

  const { data, error } = await supabase.storage.from("documents").download(path.replace(/^\/+/, ""))
  if (error || !data) {
    return { buffer: null, error: error?.message || "Storage download failed" }
  }
  const ab = await data.arrayBuffer()
  return { buffer: Buffer.from(ab), error: null }
}

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

  const includeBol = settings.factoring_include_bol !== false
  const includeRate = settings.factoring_include_rate_conf !== false
  const includePod = settings.factoring_include_pod !== false

  const attachments: Attachment[] = []

  const invPdf = await generateInvoicePdfBuffer(invoiceId)
  if (invPdf.error || !invPdf.pdf) {
    return {
      error: invPdf.error || "Could not generate invoice PDF. Check Puppeteer / server PDF support.",
      data: null,
    }
  }
  attachments.push({
    filename: sanitizeFilename(`invoice-${invoice.invoice_number || invoice.id}.pdf`),
    content: invPdf.pdf,
  })

  const loadId = invoice.load_id as string | null

  if (loadId) {
    if (includeBol) {
      const { data: bolRow } = await supabase
        .from("bols")
        .select("id, bol_number")
        .eq("load_id", loadId)
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (bolRow?.id) {
        const bolPdf = await generateBOLPDFFile(bolRow.id)
        if (bolPdf.pdf) {
          attachments.push({
            filename: sanitizeFilename(`bol-${bolRow.bol_number || bolRow.id}.pdf`),
            content: bolPdf.pdf,
          })
        }
      }

      if (!attachments.some((a) => a.filename.toLowerCase().startsWith("bol-"))) {
        const { data: bolDocs } = await supabase
          .from("documents")
          .select("id, name, type, file_url, mime_type")
          .eq("load_id", loadId)
          .eq("company_id", ctx.companyId)
          .order("created_at", { ascending: false })

        const bolDoc = bolDocs?.find(
          (d: { type?: string | null; name?: string | null }) =>
            (d.type && /bol|bill_of_lading|bill-of-lading/i.test(d.type)) ||
            (d.name && /bol|bill of lading/i.test(d.name)),
        )
        if (bolDoc?.file_url) {
          const dl = await downloadStoragePath(supabase, bolDoc.file_url)
          if (dl.buffer) {
            const ext = bolDoc.mime_type?.includes("pdf") ? "pdf" : bolDoc.name?.split(".").pop() || "pdf"
            attachments.push({
              filename: sanitizeFilename(`bol-${bolDoc.name || "document"}.${ext}`),
              content: dl.buffer,
            })
          }
        }
      }
    }

    if (includeRate) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, name, type, file_url, mime_type")
        .eq("load_id", loadId)
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      const rateDoc = docs?.find(
        (d: { type?: string | null; name?: string | null }) =>
          (d.type && /rate|confirmation|rate_conf/i.test(d.type)) ||
          (d.name && /rate|confirmation/i.test(d.name)),
      )
      if (rateDoc?.file_url) {
        const dl = await downloadStoragePath(supabase, rateDoc.file_url)
        if (dl.buffer) {
          const ext = rateDoc.name?.split(".").pop() || (rateDoc.mime_type?.includes("pdf") ? "pdf" : "pdf")
          attachments.push({
            filename: sanitizeFilename(`rate-confirmation-${rateDoc.name || "document"}.${ext}`),
            content: dl.buffer,
          })
        }
      }
    }

    if (includePod) {
      const { data: podDocs } = await supabase
        .from("documents")
        .select("id, name, type, file_url, mime_type")
        .eq("load_id", loadId)
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false })

      const pods =
        podDocs?.filter(
          (d: { type?: string | null; name?: string | null }) =>
            d.type === "pod_photo" ||
            (d.type && /pod|proof.?of.?delivery/i.test(d.type)) ||
            (d.name && /pod|proof/i.test(d.name)),
        ) || []

      let i = 0
      for (const p of pods.slice(0, 8)) {
        if (!p.file_url) continue
        const dl = await downloadStoragePath(supabase, p.file_url)
        if (!dl.buffer) continue
        const ext = p.name?.split(".").pop() || "jpg"
        i += 1
        attachments.push({
          filename: sanitizeFilename(`pod-${i}-${p.name || `file.${ext}`}`),
          content: dl.buffer,
        })
      }
    }
  }

  const docLines: string[] = ["- Invoice PDF"]
  if (includeBol) docLines.push("- Bill of Lading (if available)")
  if (includeRate) docLines.push("- Rate confirmation (if available)")
  if (includePod) docLines.push("- Proof of delivery (if available)")

  const defaultTemplate = `Please find attached invoice #{INVOICE_NUMBER} for factoring.

Load: {LOAD_NUMBER}
Customer: {CUSTOMER_NAME}
Amount: {AMOUNT}

Documents attached:
{DOCUMENTS_LIST}

Thank you,
{COMPANY_NAME}`

  let bodyTemplate =
    (typeof settings.factoring_email_template === "string" && settings.factoring_email_template.trim()
      ? settings.factoring_email_template
      : defaultTemplate) || defaultTemplate

  const documentsList = docLines.join("\n")
  let bodyText = bodyTemplate
    .replace(/\{INVOICE_NUMBER\}/g, invoice.invoice_number || "")
    .replace(/\{LOAD_NUMBER\}/g, loadNumber)
    .replace(/\{CUSTOMER_NAME\}/g, customerName)
    .replace(/\{AMOUNT\}/g, amountStr)
    .replace(/\{COMPANY_NAME\}/g, companyName)
    .replace(/\{DOCUMENTS_LIST\}/g, documentsList)
    .replace(/\#\{INVOICE_NUMBER\}/g, invoice.invoice_number || "")
    .replace(/\{LOAD\}/g, loadNumber)

  const subject = `New Invoice Submission - ${companyName} - Invoice #${invoice.invoice_number || invoice.id}`

  const bodyHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:640px">
<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(bodyText)}</pre>
</body></html>`

  const resend = await getResendClient()
  if (!resend) {
    return {
      error: "Email service not configured (RESEND_API_KEY / Resend integration).",
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
