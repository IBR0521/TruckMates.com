import { createClient } from "@/lib/supabase/server"
import { generateInvoicePdfBuffer } from "@/app/actions/invoice-pdf"
import { generateBOLPDFFile } from "@/app/actions/bol-pdf"
import { escapeHtml } from "@/lib/html-escape"

export type InvoicePacketAttachment = { filename: string; content: Buffer }

export type InvoicePacketSettings = {
  factoring_include_bol?: boolean
  factoring_include_rate_conf?: boolean
  factoring_include_pod?: boolean
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "attachment"
}

async function downloadStoragePath(
  supabase: SupabaseServer,
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
 * Invoice PDF plus optional BOL / rate confirmation / POD — same packet as “Send to factoring”.
 */
export async function buildInvoicePacketAttachments(
  supabase: SupabaseServer,
  companyId: string,
  invoiceId: string,
  invoice: { id: string; invoice_number: string | null; load_id: string | null },
  settings: InvoicePacketSettings,
): Promise<{
  attachments: InvoicePacketAttachment[]
  docLines: string[]
  error: string | null
}> {
  const includeBol = settings.factoring_include_bol !== false
  const includeRate = settings.factoring_include_rate_conf !== false
  const includePod = settings.factoring_include_pod !== false

  const attachments: InvoicePacketAttachment[] = []

  const invPdf = await generateInvoicePdfBuffer(invoiceId)
  if (invPdf.error || !invPdf.pdf) {
    return {
      attachments: [],
      docLines: [],
      error: invPdf.error || "Could not generate invoice PDF.",
    }
  }

  attachments.push({
    filename: sanitizeFilename(`invoice-${invoice.invoice_number || invoice.id}.pdf`),
    content: invPdf.pdf,
  })

  const loadId = invoice.load_id

  if (loadId) {
    if (includeBol) {
      const { data: bolRow } = await supabase
        .from("bols")
        .select("id, bol_number")
        .eq("load_id", loadId)
        .eq("company_id", companyId)
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
          .eq("company_id", companyId)
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
        .eq("company_id", companyId)
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
        .eq("company_id", companyId)
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

  return { attachments, docLines, error: null }
}

const DEFAULT_PACKET_TEMPLATE = `Please find attached invoice #{INVOICE_NUMBER} for factoring.

Load: {LOAD_NUMBER}
Customer: {CUSTOMER_NAME}
Amount: {AMOUNT}

Documents attached:
{DOCUMENTS_LIST}

Thank you,
{COMPANY_NAME}`

/**
 * Same subject + body as “Send to factoring” (uses Settings → Factoring email template when set).
 */
export function buildInvoicePacketEmailContent(params: {
  settings: Record<string, unknown>
  invoiceNumber: string
  companyName: string
  loadNumber: string
  customerName: string
  amountStr: string
  docLines: string[]
}): { subject: string; bodyText: string; bodyHtml: string } {
  const { settings, invoiceNumber, companyName, loadNumber, customerName, amountStr, docLines } = params

  const documentsList = docLines.join("\n")

  let bodyTemplate =
    (typeof settings.factoring_email_template === "string" && settings.factoring_email_template.trim()
      ? settings.factoring_email_template
      : DEFAULT_PACKET_TEMPLATE) || DEFAULT_PACKET_TEMPLATE

  const bodyText = bodyTemplate
    .replace(/\{INVOICE_NUMBER\}/g, invoiceNumber)
    .replace(/\{LOAD_NUMBER\}/g, loadNumber)
    .replace(/\{CUSTOMER_NAME\}/g, customerName)
    .replace(/\{AMOUNT\}/g, amountStr)
    .replace(/\{COMPANY_NAME\}/g, companyName)
    .replace(/\{DOCUMENTS_LIST\}/g, documentsList)
    .replace(/\#\{INVOICE_NUMBER\}/g, invoiceNumber)
    .replace(/\{LOAD\}/g, loadNumber)

  const subject = `New Invoice Submission - ${companyName} - Invoice #${invoiceNumber}`

  const bodyHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:640px">
<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(bodyText)}</pre>
</body></html>`

  return { subject, bodyText, bodyHtml }
}
