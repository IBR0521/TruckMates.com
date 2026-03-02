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

  // HIGH FIX: Require proper user authentication via JWT token
  // This function should only be called by authenticated users or internal services
  const authHeader = req.headers.get("authorization")
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized - valid JWT token required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  // Create Supabase client to verify JWT token
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Service not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  // Verify JWT token and get user
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized - invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  try {
    // HIGH FIX: Get user's company_id from authenticated user record
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Get user's company_id from users table
    const { data: userData, error: userError } = await supabaseService
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (userError || !userData?.company_id) {
      return new Response(
        JSON.stringify({ error: "User company not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const companyId = userData.company_id
    const limit = parseInt(new URL(req.url).searchParams.get("limit") || "100")

    // HIGH FIX: Always filter by authenticated user's company_id
    const { data: events, error: eventsError } = await supabaseService
      .from("eld_events")
      .select("*")
      .eq("maintenance_created", false)
      .not("fault_code", "is", null)
      .eq("company_id", companyId) // Always filter by user's company
      .order("event_time", { ascending: false })
      .limit(limit)

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
        const { data: maintenanceId, error: analysisError } = await supabaseService.rpc(
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



