"use server"

import { createClient } from "@/lib/supabase/server"
import { getCompanySettings } from "./number-formats"

/**
 * Send invoice email with template support
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  options?: {
    subject?: string
    body?: string
    cc_emails?: string[]
    bcc_emails?: string[]
    send_copy_to_company?: boolean
    include_bol?: boolean
    auto_attach_documents?: boolean
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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
    .eq("company_id", userData.company_id)
    .single()

  if (invoiceError || !invoice) {
    return { error: "Invoice not found", data: null }
  }

  // Get company settings for email templates
  const settingsResult = await getCompanySettings()
  const settings = settingsResult.data || {}

  // Get company info
  const { data: company } = await supabase
    .from("companies")
    .select("name, email")
    .eq("id", userData.company_id)
    .single()

  // Prepare email data
  const customerEmail = invoice.loads?.customers?.email || invoice.customer_name
  const customerName = invoice.loads?.customers?.name || invoice.loads?.customers?.company_name || invoice.customer_name
  const companyName = company?.name || settings.company_name_display || "Company"

  // Build subject with token replacement
  let subject = options?.subject || settings.invoice_email_subject || "Invoice {INVOICE_NUMBER} from {COMPANY_NAME}"
  subject = subject
    .replace(/{INVOICE_NUMBER}/g, invoice.invoice_number)
    .replace(/{COMPANY_NAME}/g, companyName)
    .replace(/{AMOUNT}/g, `$${Number(invoice.amount).toFixed(2)}`)

  // Build body with token replacement
  let body = options?.body || settings.invoice_email_body || `Dear {CUSTOMER_NAME},\n\nPlease find attached invoice {INVOICE_NUMBER} for {AMOUNT}.\n\nPayment is due by {DUE_DATE}.\n\nThank you!`
  body = body
    .replace(/{CUSTOMER_NAME}/g, customerName)
    .replace(/{INVOICE_NUMBER}/g, invoice.invoice_number)
    .replace(/{AMOUNT}/g, `$${Number(invoice.amount).toFixed(2)}`)
    .replace(/{DUE_DATE}/g, new Date(invoice.due_date).toLocaleDateString())

  // TODO: Implement actual email sending (using Resend, SendGrid, etc.)
  // For now, just log the email data
  console.log("Invoice email would be sent:", {
    to: customerEmail,
    subject,
    body,
    cc: options?.cc_emails || [],
    bcc: options?.bcc_emails || [],
    invoice_id: invoiceId,
  })

  // Update invoice status to "sent" if auto-send is enabled
  if (settings.invoice_auto_send) {
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId)
  }

  return { data: { sent: true, subject, body }, error: null }
}

