"use server"

import { createClient } from "@/lib/supabase/server"
import { getCompanySettings } from "./number-formats"
import { revalidatePath } from "next/cache"

// Helper to get Resend client (checks both env var and database)
async function getResendClient() {
  // Always use platform API key from environment variables
  const apiKey = process.env.RESEND_API_KEY
  
  if (!apiKey) {
    console.error("[RESEND] Platform API key not configured")
    return null
  }

  // Check if integration is enabled for this company
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { getCachedUserCompany } = await import("@/lib/query-optimizer")
      const result = await getCachedUserCompany(user.id)
      
      if (result.company_id) {
        const { data: integrations } = await supabase
          .from("company_integrations")
          .select("resend_enabled")
          .eq("company_id", result.company_id)
          .single()

        if (!integrations?.resend_enabled) {
          console.log("[RESEND] Integration not enabled for company")
          return null
        }
      }
    }
  } catch (error) {
    console.error("[RESEND] Error checking integration:", error)
    return null
  }
  
  try {
    const { Resend } = await import("resend")
    return new Resend(apiKey)
  } catch (error) {
    console.error("[RESEND] Failed to initialize Resend client:", error)
    return null
  }
}

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
  if (!customerEmail || !customerEmail.includes("@")) {
    return { error: "Customer email is required and must be valid", data: null }
  }
  
  const customerName = invoice.loads?.customers?.name || invoice.loads?.customers?.company_name || invoice.customer_name || "Customer"
  const companyName = company?.name || settings.company_name_display || "Company"
  const companyEmail = company?.email || process.env.RESEND_FROM_EMAIL || "noreply@truckmates.com"

  // Build subject with token replacement
  let subject = options?.subject || settings.invoice_email_subject || "Invoice {INVOICE_NUMBER} from {COMPANY_NAME}"
  subject = subject
    .replace(/{INVOICE_NUMBER}/g, invoice.invoice_number)
    .replace(/{COMPANY_NAME}/g, companyName)
    .replace(/{AMOUNT}/g, `$${Number(invoice.amount).toFixed(2)}`)

  // Build body with token replacement
  let bodyText = options?.body || settings.invoice_email_body || `Dear {CUSTOMER_NAME},\n\nPlease find attached invoice {INVOICE_NUMBER} for {AMOUNT}.\n\nPayment is due by {DUE_DATE}.\n\nThank you!`
  bodyText = bodyText
    .replace(/{CUSTOMER_NAME}/g, customerName)
    .replace(/{INVOICE_NUMBER}/g, invoice.invoice_number)
    .replace(/{AMOUNT}/g, `$${Number(invoice.amount).toFixed(2)}`)
    .replace(/{DUE_DATE}/g, new Date(invoice.due_date).toLocaleDateString())
    .replace(/{COMPANY_NAME}/g, companyName)

  // Convert plain text to HTML for better email formatting
  const bodyHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0;">Invoice ${invoice.invoice_number}</h2>
        <p style="margin: 5px 0;"><strong>Amount:</strong> $${Number(invoice.amount).toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
        ${invoice.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${invoice.description}</p>` : ""}
      </div>
      <div style="white-space: pre-wrap;">${bodyText.replace(/\n/g, "<br>")}</div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">This is an automated email from ${companyName}. Please do not reply to this email.</p>
    </body>
    </html>
  `

  // Get Resend client
  const resend = await getResendClient()
  
  if (!resend) {
    // If Resend is not configured, log and return error
    console.warn("[INVOICE EMAIL] Resend API key not configured. Email not sent.")
    return { 
      error: "Email service not configured. Please set RESEND_API_KEY in environment variables.", 
      data: null 
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

  // Get invoice PDF URL if available (for attachment)
  let attachments: any[] = []
  if (options?.include_bol || options?.auto_attach_documents) {
    // Try to get BOL or invoice PDF
    // This would need to be implemented based on your PDF generation setup
    // For now, we'll skip attachments
  }

  try {
    // Get from email (check env var, then database, then default)
    let fromEmail = process.env.RESEND_FROM_EMAIL
    if (!fromEmail) {
      try {
        const supabase = await createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { getCachedUserCompany } = await import("@/lib/query-optimizer")
          const result = await getCachedUserCompany(user.id)
          
          if (result.company_id) {
            const { data: integrations } = await supabase
              .from("company_integrations")
              .select("resend_from_email")
              .eq("company_id", result.company_id)
              .single()

            if (integrations?.resend_from_email) {
              fromEmail = integrations.resend_from_email
            }
          }
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
      subject: subject,
      html: bodyHtml,
      text: bodyText,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    if (emailResult.error) {
      console.error("[INVOICE EMAIL ERROR]", emailResult.error)
      return { 
        error: `Failed to send email: ${emailResult.error.message || "Unknown error"}`, 
        data: null 
      }
    }

    // Update invoice status to "sent"
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId)

    revalidatePath("/dashboard/accounting/invoices")
    revalidatePath(`/dashboard/accounting/invoices/${invoiceId}`)

    return { 
      data: { 
        sent: true, 
        subject, 
        body: bodyText,
        emailId: emailResult.data?.id,
        to: customerEmail,
        messageId: emailResult.data?.id
      }, 
      error: null 
    }
  } catch (error: any) {
    console.error("[INVOICE EMAIL ERROR]", error)
    return { 
      error: `Failed to send email: ${error?.message || "Unknown error"}`, 
      data: null 
    }
  }
}







