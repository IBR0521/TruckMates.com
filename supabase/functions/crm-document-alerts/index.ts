// Supabase Edge Function: CRM Document Expiration Alerts
// Sends alerts 30 days before documents expire

// @ts-ignore - Deno runtime import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Deno global type declaration for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// BUG-048 FIX: Remove CORS wildcard - this function should never be called from browser
// BUG-048 FIX: Add CRON_SECRET authentication like daily-reminders-check
const CRON_SECRET = Deno.env.get("CRON_SECRET")

serve(async (req: Request) => {
  // BUG-048 FIX: Require CRON_SECRET authentication
  const authHeader = req.headers.get("Authorization")
  const providedSecret = authHeader?.replace("Bearer ", "")
  
  if (!CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET not configured - endpoint disabled" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }
  
  if (providedSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Get all documents expiring in the next 30 days that haven't been alerted
    const { data: expiringDocuments, error: fetchError } = await supabaseClient.rpc(
      "get_expiring_crm_documents",
      { days_ahead: 30 }
    )

    if (fetchError) {
      throw fetchError
    }

    if (!expiringDocuments || expiringDocuments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expiring documents found", count: 0 }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    // Filter to only documents that haven't been alerted yet
    const documentsToAlert = expiringDocuments.filter(
      (doc: any) => !doc.expiration_alert_sent && doc.days_until_expiration <= 30
    )

    if (documentsToAlert.length === 0) {
      return new Response(
        JSON.stringify({ message: "All expiring documents have been alerted", count: 0 }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    // Get company details and users for each company
    const companyIds = [...new Set(documentsToAlert.map((doc: any) => doc.company_id))]
    const alerts: any[] = []

    for (const companyId of companyIds) {
      // BUG-057 FIX: Use actual role values that exist in the schema
      // Get company users (super_admin, operations_manager)
      const { data: users, error: usersError } = await supabaseClient
        .from("users")
        .select("id, email, full_name, role")
        .eq("company_id", companyId)
        .in("role", ["super_admin", "operations_manager"])
      
      // BUG-057 FIX: Log warning if no users found for a company
      if (!users || users.length === 0) {
        console.warn(`[CRM Document Alerts] No eligible users found for company ${companyId}`)
        continue
      }

      if (usersError || !users) continue

      // Get company name
      const { data: company } = await supabaseClient
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single()

      // Get documents for this company
      const companyDocs = documentsToAlert.filter((doc: any) => doc.company_id === companyId)

      for (const doc of companyDocs) {
        // FIXED: Helper function to escape HTML to prevent XSS
        const esc = (s: string | null | undefined): string => {
          if (!s) return ""
          return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
        }

        // Create alert in database
        const { error: alertError, data: alertData } = await supabaseClient.from("alerts").insert({
          company_id: companyId,
          title: `Document Expiring: ${doc.name}`,
          message: `${doc.document_type.toUpperCase()} for ${doc.customer_name || doc.vendor_name || "Unknown"} expires in ${doc.days_until_expiration} days`,
          event_type: "document_expiration",
          priority: doc.days_until_expiration <= 7 ? "high" : "normal",
          metadata: {
            document_id: doc.id,
            document_type: doc.document_type,
            expiration_date: doc.expiration_date,
            days_until_expiration: doc.days_until_expiration,
          },
        }).select().single()

        // FIXED: Only mark as alerted and send email if alert insert succeeded
        if (!alertError && alertData) {
          // Mark document as alerted
          await supabaseClient
            .from("crm_documents")
            .update({ expiration_alert_sent: true })
            .eq("id", doc.id)

          // Send email notifications (if Resend API key is configured)
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
          if (RESEND_API_KEY) {
            for (const user of users) {
              if (user.email) {
                try {
                  // FIXED: Escape all user-controlled values to prevent XSS
                  await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                      from: "TruckMates <noreply@truckmates.com>",
                      to: user.email,
                      subject: `⚠️ Document Expiring: ${esc(doc.name)}`,
                      html: `
                        <h2>Document Expiration Alert</h2>
                        <p>Hello ${esc(user.full_name || "User")},</p>
                        <p>The following document is expiring soon:</p>
                        <ul>
                          <li><strong>Document:</strong> ${esc(doc.name)}</li>
                          <li><strong>Type:</strong> ${esc(doc.document_type?.toUpperCase())}</li>
                          <li><strong>Entity:</strong> ${esc(doc.customer_name || doc.vendor_name || "Unknown")}</li>
                          <li><strong>Expiration Date:</strong> ${esc(new Date(doc.expiration_date).toLocaleDateString())}</li>
                          <li><strong>Days Remaining:</strong> ${esc(String(doc.days_until_expiration))}</li>
                        </ul>
                        <p>Please renew this document to avoid compliance issues.</p>
                      `,
                    }),
                  })
                } catch (emailError) {
                  // FIXED: Log error but don't fail silently - mark alert as failed
                  console.error("Failed to send email:", emailError)
                  // Could update alert metadata to track email failure
                }
              }
            }
          }
        } else {
          // FIXED: Log alert creation failure - don't mark document as alerted
          console.error("Failed to create alert for document:", doc.id, alertError)
        }

        alerts.push({
          document_id: doc.id,
          company_id: companyId,
          company_name: company?.name,
          document_name: doc.name,
          days_until_expiration: doc.days_until_expiration,
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: "Document expiration alerts processed",
        count: alerts.length,
        alerts,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process document alerts" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})



