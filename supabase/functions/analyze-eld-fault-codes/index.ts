// Supabase Edge Function: Analyze ELD Fault Codes
// Automatically analyzes new ELD events with fault codes and creates maintenance work orders

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Get query parameters
    const url = new URL(req.url)
    const companyId = url.searchParams.get("company_id")
    const limit = parseInt(url.searchParams.get("limit") || "100")

    // Get new ELD events with fault codes that haven't been analyzed
    let query = supabase
      .from("eld_events")
      .select("*")
      .eq("maintenance_created", false)
      .not("fault_code", "is", null)
      .order("event_time", { ascending: false })
      .limit(limit)

    if (companyId) {
      query = query.eq("company_id", companyId)
    }

    const { data: events, error: eventsError } = await query

    if (eventsError) {
      console.error("Error fetching events:", eventsError)
      return new Response(
        JSON.stringify({ error: eventsError.message, processed: 0 }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, created: 0, skipped: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    let processed = 0
    let created = 0
    let skipped = 0

    // Process each event
    for (const event of events) {
      try {
        // Call database function to analyze and create maintenance
        const { data: maintenanceId, error: analysisError } = await supabase.rpc(
          "analyze_fault_code_and_create_maintenance",
          { p_event_id: event.id }
        )

        processed++

        if (analysisError) {
          console.error(`Failed to analyze event ${event.id}:`, analysisError)
          skipped++
          continue
        }

        if (maintenanceId) {
          created++
          console.log(`Created maintenance ${maintenanceId} from fault code event ${event.id}`)
        } else {
          skipped++
        }
      } catch (error: any) {
        console.error(`Error processing event ${event.id}:`, error)
        skipped++
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        created,
        skipped,
        message: `Processed ${processed} events, created ${created} maintenance records`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error: any) {
    console.error("Edge function error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})


