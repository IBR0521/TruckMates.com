// Supabase Edge Function: Daily Reminders Check
// Runs daily to auto-create maintenance reminders and check for expiring documents

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Auto-create maintenance reminders from schedule
    const { data: remindersCreated, error: remindersError } = await supabase.rpc(
      "auto_create_maintenance_reminders_from_schedule"
    )

    if (remindersError) {
      console.error("[Daily Reminders] Error creating maintenance reminders:", remindersError)
    }

    // Check for expiring documents and create alerts
    // This is handled by database triggers, but we can also run a manual check here
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const { data: expiringDocuments, error: documentsError } = await supabase
      .from("crm_documents")
      .select("id, document_type, expiration_date, customer_id, vendor_id")
      .not("expiration_date", "is", null)
      .lte("expiration_date", thirtyDaysFromNow.toISOString().split("T")[0])
      .gte("expiration_date", new Date().toISOString().split("T")[0])

    if (documentsError) {
      console.error("[Daily Reminders] Error checking expiring documents:", documentsError)
    }

    // Check for expiring insurance/licenses
    // Note: Adjust table name based on your schema
    const { data: expiringInsurance, error: insuranceError } = await supabase
      .from("insurance")
      .select("id, insurance_type, expiration_date, truck_id")
      .not("expiration_date", "is", null)
      .lte("expiration_date", thirtyDaysFromNow.toISOString().split("T")[0])
      .gte("expiration_date", new Date().toISOString().split("T")[0])
      .catch(() => {
        // Insurance table might not exist, that's okay
        return { data: null, error: null }
      })

    return new Response(
      JSON.stringify({
        success: true,
        reminders_created: remindersCreated || 0,
        expiring_documents: expiringDocuments?.length || 0,
        expiring_insurance: expiringInsurance?.length || 0,
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



