"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getCompanySettings } from "./number-formats"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { getResendClientForCompany } from "@/lib/resend-client"
import { buildInvoicePacketAttachments, buildInvoicePacketEmailContent } from "@/lib/invoice-packet-build"
import { capturePostHogServerEvent } from "@/lib/analytics/posthog-server"

/** Exported for factoring / other transactional email that uses the same Resend integration. */
export async function getResendClient() {
  const ctx = await getCachedAuthContext()
  const client = await getResendClientForCompany(ctx.companyId ?? null)
  if (!client) {
    Sentry.captureMessage("[RESEND] No API key (set RESEND_API_KEY or add key in Settings → Integration)", "warning")
  }
  return client
}

/**
 * Send invoice email with template support
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  options?: {
    /** @deprecated Ignored — body matches factoring packet template (Settings → Factoring). */
    subject?: string
    /** @deprecated Ignored — body matches factoring packet template. */
    body?: string
    cc_emails?: string[]
    bcc_emails?: string[]
    send_copy_to_company?: boolean
    /** @deprecated Packet always includes invoice PDF + optional BOL/rate/POD (same as factoring). */
    include_bol?: boolean
    /** @deprecated See include_bol. */
    auto_attach_documents?: boolean
  }
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

    // Check rate limit for Resend API
    try {
      const { checkApiUsage } = await import("@/lib/api-protection")
      const rateCheck = await checkApiUsage("resend", "send_email")
      if (!rateCheck.allowed) {
        return {
          error: rateCheck.reason || "Email rate limit exceeded. Please try again later.",
          data: null
        }
      }
    } catch (error) {
      // BUG-065 FIX: Fail closed instead of fail open for billing-adjacent operations
      // Deny the request if rate limit check throws rather than allowing it
      Sentry.captureException(error)
      return {
        error: "Rate limit check failed. Please try again later.",
        data: null
      }
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      *,
      loads:load_id (
        id,
        shipment_number,
        customer_id,
        customers:customer_id (
          id,
          name,
          email,
          company_name
        )
      )
    `)
    .eq("id", invoiceId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  const settingsResult = await getCompanySettings()
  const settings = (settingsResult.data || {}) as Record<string, unknown>

    const { data: company } = await supabase
      .from("companies")
      .select("name, email")
      .eq("id", ctx.companyId)
      .maybeSingle()

    const customerEmail = invoice.loads?.customers?.email || invoice.customer_name
    if (!customerEmail || !customerEmail.includes("@")) {
      return { error: "Customer email is required and must be valid", data: null }
    }

    const loadRow = invoice.loads as { shipment_number?: string | null; company_name?: string | null } | null
    let loadNumber = loadRow?.shipment_number || "—"
    if (!loadRow?.shipment_number && invoice.load_id) {
      const { data: lr } = await supabase
        .from("loads")
        .select("shipment_number")
        .eq("id", invoice.load_id)
        .eq("company_id", ctx.companyId)
        .maybeSingle()
      if (lr?.shipment_number) loadNumber = lr.shipment_number
    }

    const customerName =
      invoice.loads?.customers?.name ||
      invoice.loads?.customers?.company_name ||
      invoice.customer_name ||
      loadRow?.company_name ||
      "Customer"
    const companyName = company?.name || (settings.company_name_display as string) || "Company"
    const companyEmail = company?.email || process.env.RESEND_FROM_EMAIL || "noreply@truckmates.com"
    const amountStr = `$${Number(invoice.amount || 0).toFixed(2)}`

    const packet = await buildInvoicePacketAttachments(
      supabase,
      ctx.companyId,
      invoiceId,
      {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        load_id: invoice.load_id,
      },
      {
        factoring_include_bol: settings.factoring_include_bol !== false,
        factoring_include_rate_conf: settings.factoring_include_rate_conf !== false,
        factoring_include_pod: settings.factoring_include_pod !== false,
      },
    )

    if (packet.error) {
      return { error: packet.error, data: null }
    }

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
      // If Resend is not configured, log and return error
      Sentry.captureMessage("[INVOICE EMAIL] Resend API key not configured. Email not sent.", "warning")
      return {
        error:
          "Email service not configured. Add RESEND_API_KEY to your server environment, or save your Resend API key under Settings → Integration.",
        data: null,
      }
    }

    // Prepare recipients
    const toEmails = [customerEmail]
    const ccEmails = options?.cc_emails || []
    const bccEmails = options?.bcc_emails || []
    
    // Add company email to BCC if requested
    if (options?.send_copy_to_company && companyEmail) {
      bccEmails.push(companyEmail)
    }

    const attachments = packet.attachments

    // Get from email (check env var, then database, then default)
    let fromEmail = process.env.RESEND_FROM_EMAIL
    if (!fromEmail && ctx.companyId) {
      try {
        const { data: integrations } = await supabase
          .from("company_integrations")
          .select("resend_from_email")
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (integrations?.resend_from_email) {
          fromEmail = integrations.resend_from_email
        }
      } catch (error) {
        // Silently fail - will use default
      }
    }
    fromEmail = fromEmail || "onboarding@resend.dev"
    
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      bcc: bccEmails.length > 0 ? bccEmails : undefined,
      subject,
      html: bodyHtml,
      text: bodyText,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
    })

    if (emailResult.error) {
      Sentry.captureException(emailResult.error)
      return { 
        error: `Failed to send email: ${emailResult.error.message || "Unknown error"}`, 
        data: null 
      }
    }

    // Record email send into CRM contact_history so it appears in unified communications.
    const customerId = invoice.loads?.customers?.id ? String(invoice.loads.customers.id) : null
    if (customerId) {
      try {
        await supabase.from("contact_history").insert({
          company_id: ctx.companyId,
          customer_id: customerId,
          type: "email",
          subject,
          message: bodyText,
          direction: "outbound",
          load_id: invoice.load_id || null,
          invoice_id: invoiceId,
          user_id: ctx.userId ?? null,
          occurred_at: new Date().toISOString(),
          attachments: null,
          external_id: emailResult.data?.id || null,
          source: "email",
          metadata: {
            to: customerEmail,
            cc: ccEmails,
            bcc: bccEmails,
            resend_id: emailResult.data?.id || null,
          },
        })
      } catch (logError) {
        Sentry.captureException(logError)
      }
    }

    // Update invoice status to "sent"
    // V3-001 FIX: Add company_id filter to prevent IDOR
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId)
      .eq("company_id", ctx.companyId)

    await capturePostHogServerEvent(ctx.userId || `company:${ctx.companyId}`, "invoice_sent", {
      company_id: ctx.companyId,
      user_id: ctx.userId || null,
      invoice_id: invoiceId,
      resend_email_id: emailResult.data?.id || null,
    })

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

    return {
      data: {
        sent: true,
        subject,
        body: bodyText,
        emailId: emailResult.data?.id,
        to: customerEmail,
        messageId: emailResult.data?.id,
        attachmentCount: attachments.length,
      },
      error: null,
    }
}







