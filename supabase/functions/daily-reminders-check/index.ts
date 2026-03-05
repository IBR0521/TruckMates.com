// Supabase Edge Function: Daily Reminders Check
// Runs daily to auto-create maintenance reminders and check for expiring documents

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? ""

serve(async (req: Request) => {
  // SECURITY FIX 2: Authentication check
  const authHeader = req.headers.get("Authorization")
  const expectedSecret = `Bearer ${CRON_SECRET}`
  
  if (!authHeader || authHeader !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get all companies to process reminders for each
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id")

    if (companiesError) {
      console.error("[Daily Reminders] Error fetching companies:", companiesError)
      return new Response(
        JSON.stringify({ error: "Failed to fetch companies" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    let totalRemindersCreated = 0

    // Process each company separately
    for (const company of companies || []) {
      // Auto-create maintenance reminders from schedule for this company
      const { data: remindersCreated, error: remindersError } = await supabase.rpc(
        "auto_create_maintenance_reminders_from_schedule",
        { p_company_id: company.id }
      )

      if (remindersError) {
        console.error(`[Daily Reminders] Error creating maintenance reminders for company ${company.id}:`, remindersError)
      } else {
        totalRemindersCreated += remindersCreated || 0
      }
    }

    // HIGH FIX 1: Create reminders from expiring documents and insurance
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const today = new Date().toISOString().split("T")[0]

    let expiringDocumentsCount = 0
    let expiringInsuranceCount = 0

    // Process each company separately
    for (const company of companies || []) {
      // Check for expiring documents
      const { data: expiringDocuments, error: documentsError } = await supabase
        .from("crm_documents")
        .select("id, document_type, expiration_date, customer_id, vendor_id, company_id")
        .eq("company_id", company.id)
        .not("expiration_date", "is", null)
        .lte("expiration_date", thirtyDaysFromNow.toISOString().split("T")[0])
        .gte("expiration_date", today)

      if (documentsError) {
        console.error(`[Daily Reminders] Error checking expiring documents for company ${company.id}:`, documentsError)
      } else if (expiringDocuments) {
        expiringDocumentsCount += expiringDocuments.length

        // Create reminders for each expiring document
        for (const doc of expiringDocuments) {
          // Check if reminder already exists for this document
          const { data: existingReminder } = await supabase
            .from("reminders")
            .select("id")
            .eq("company_id", company.id)
            .eq("reminder_type", "insurance_renewal")
            .eq("due_date", doc.expiration_date)
            .contains("metadata", { document_id: doc.id })
            .single()

          if (!existingReminder) {
            const { error: reminderError } = await supabase
              .from("reminders")
              .insert({
                company_id: company.id,
                title: `Document Expiring: ${doc.document_type}`,
                description: `Document ${doc.document_type} expires on ${doc.expiration_date}`,
                reminder_type: "insurance_renewal",
                due_date: doc.expiration_date,
                reminder_date: doc.expiration_date, // Remind on expiration date
                status: "pending",
                metadata: { document_id: doc.id, document_type: doc.document_type },
              })

            if (reminderError) {
              console.error(`[Daily Reminders] Error creating reminder for document ${doc.id}:`, reminderError)
            }
          }
        }
      }

      // Check for expiring insurance/licenses
      const { data: expiringInsurance, error: insuranceError } = await supabase
        .from("insurance")
        .select("id, insurance_type, expiration_date, truck_id, company_id")
        .eq("company_id", company.id)
        .not("expiration_date", "is", null)
        .lte("expiration_date", thirtyDaysFromNow.toISOString().split("T")[0])
        .gte("expiration_date", today)

      if (insuranceError) {
        // Insurance table might not exist, that's okay
        console.log(`[Daily Reminders] Insurance table not available for company ${company.id}`)
      } else if (expiringInsurance) {
        expiringInsuranceCount += expiringInsurance.length

        // Create reminders for each expiring insurance
        for (const insurance of expiringInsurance) {
          // Check if reminder already exists
          const { data: existingReminder } = await supabase
            .from("reminders")
            .select("id")
            .eq("company_id", company.id)
            .eq("reminder_type", "insurance_renewal")
            .eq("due_date", insurance.expiration_date)
            .contains("metadata", { insurance_id: insurance.id })
            .single()

          if (!existingReminder) {
            const { error: reminderError } = await supabase
              .from("reminders")
              .insert({
                company_id: company.id,
                title: `Insurance Expiring: ${insurance.insurance_type}`,
                description: `${insurance.insurance_type} expires on ${insurance.expiration_date}`,
                reminder_type: "insurance_renewal",
                due_date: insurance.expiration_date,
                reminder_date: insurance.expiration_date,
                truck_id: insurance.truck_id,
                status: "pending",
                metadata: { insurance_id: insurance.id, insurance_type: insurance.insurance_type },
              })

            if (reminderError) {
              console.error(`[Daily Reminders] Error creating reminder for insurance ${insurance.id}:`, reminderError)
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_created: totalRemindersCreated,
        expiring_documents: expiringDocumentsCount,
        expiring_insurance: expiringInsuranceCount,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error("[Daily Reminders] Unhandled error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})



