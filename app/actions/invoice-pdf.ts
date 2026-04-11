"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { htmlToPdfBuffer } from "@/lib/html-to-pdf-server"
import { escapeHtml } from "@/lib/html-escape"
import { normalizeInvoiceLineItems } from "@/lib/invoice-line-items"

function buildInvoiceHtml(payload: {
  invoice_number: string
  customer_name: string
  amount: number
  status: string
  issue_date: string
  due_date: string
  payment_terms: string
  description: string | null
  items: Array<{ description?: string; quantity?: number; rate?: number; amount?: number }>
}) {
  const items = normalizeInvoiceLineItems(payload.items, payload.amount)

  const rows = items
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.description || "Item")}</td>
      <td style="text-align:right">${item.quantity ?? 1}</td>
      <td style="text-align:right">$${Number(item.rate ?? item.amount ?? 0).toFixed(2)}</td>
      <td style="text-align:right">$${Number(item.amount ?? 0).toFixed(2)}</td>
    </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Invoice ${escapeHtml(payload.invoice_number)}</title>
<style>
body{font-family:Arial,sans-serif;padding:24px;color:#111}
h1{color:#1e3a8a}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #ddd;padding:8px}
th{background:#f3f4f6;text-align:left}
tfoot td{font-weight:bold}
</style></head><body>
<h1>Invoice ${escapeHtml(payload.invoice_number)}</h1>
<p><strong>Bill to:</strong> ${escapeHtml(payload.customer_name)}</p>
<p><strong>Issue:</strong> ${escapeHtml(payload.issue_date)} &nbsp; <strong>Due:</strong> ${escapeHtml(payload.due_date)}</p>
<p><strong>Terms:</strong> ${escapeHtml(payload.payment_terms)} &nbsp; <strong>Status:</strong> ${escapeHtml(payload.status)}</p>
<table><thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">$${payload.amount.toFixed(2)}</td></tr></tfoot>
</table>
${payload.description ? `<p><strong>Notes:</strong> ${escapeHtml(payload.description)}</p>` : ""}
</body></html>`
}

/**
 * Generate invoice PDF buffer for email attachments (factoring, etc.).
 */
export async function generateInvoicePdfBuffer(invoiceId: string): Promise<{ pdf: Buffer | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { pdf: null, error: ctx.error || "Not authenticated" }
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, customer_name, amount, status, issue_date, due_date, payment_terms, description, items",
    )
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error || !invoice) {
    return { pdf: null, error: error?.message || "Invoice not found" }
  }

  const html = buildInvoiceHtml({
    invoice_number: invoice.invoice_number || invoice.id,
    customer_name: invoice.customer_name || "Customer",
    amount: Number(invoice.amount) || 0,
    status: invoice.status || "pending",
    issue_date: invoice.issue_date ? String(invoice.issue_date) : "",
    due_date: invoice.due_date ? String(invoice.due_date) : "",
    payment_terms: invoice.payment_terms || "Net 30",
    description: invoice.description,
    items: (invoice.items as any[]) || [],
  })

  return htmlToPdfBuffer(html)
}
