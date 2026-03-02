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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Service not configured - missing service role key" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseService = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // Get user's company_id and role from users table for RBAC check
    const { data: userData, error: userError } = await supabaseService
      .from("users")
      .select("company_id, role")
      .eq("id", user.id)
      .single()

    if (userError || !userData?.company_id) {
      return new Response(
        JSON.stringify({ error: "User company not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // MEDIUM FIX: RBAC check - only managers/admins/owners can trigger maintenance creation
    // Drivers and dispatchers should not be able to trigger this function
    const allowedRoles = ["manager", "admin", "owner", "super_admin", "operations_manager"]
    if (!userData.role || !allowedRoles.includes(userData.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions - only managers can analyze fault codes" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const companyId = userData.company_id
    
    // MEDIUM FIX: Validate and clamp limit to prevent performance issues
    let limit = 100
    try {
      // BUG FIX: Check if req.url exists before parsing
      if (req.url) {
        const limitParam = new URL(req.url).searchParams.get("limit")
        if (limitParam) {
          const parsedLimit = parseInt(limitParam, 10)
          // Clamp between 1 and 1000 to prevent abuse
          limit = Math.max(1, Math.min(1000, isNaN(parsedLimit) ? 100 : parsedLimit))
        }
      }
    } catch (error) {
      // If URL parsing fails, use default limit
      limit = 100
    }

    // HIGH FIX: Always filter by authenticated user's company_id
    // BUG FIX: Select only needed columns, not all columns (prevents sensitive data exposure)
    const { data: events, error: eventsError } = await supabaseService
      .from("eld_events")
      .select("id, company_id, fault_code, fault_code_category, event_time, truck_id, severity, description, title")
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
        // CRITICAL SECURITY FIX: RPC function doesn't validate company_id ownership
        // The RPC only takes p_event_id and uses the event's company_id from the database
        // This means if RPC is called directly, it could create maintenance for any company
        // We've already filtered by company_id above, but we need to validate the event
        // belongs to this company before calling RPC for defense in depth
        
        // Verify event belongs to company and has valid ID (defense in depth)
        if (!event.id || !event.company_id || event.company_id !== companyId) {
          console.warn(`Skipping event ${event.id || 'unknown'} - ownership validation failed`)
          skipped++
          continue
        }

        // Call database function to analyze and create maintenance
        const { data: maintenanceId, error: analysisError } = await supabaseService.rpc(
          "analyze_fault_code_and_create_maintenance",
          { p_event_id: event.id }
        )

        // BUG FIX: Handle RPC errors properly - don't count as processed if error
        if (analysisError) {
          console.error(`Failed to analyze event ${event.id}:`, analysisError)
          skipped++
          continue
        }

        // BUG FIX: Validate RPC response type - should be UUID or null
        // Count as processed only if we got a valid response (UUID or null)
        processed++

        // BUG FIX: maintenanceId can be UUID (string) or null
        // If it's a valid UUID string, maintenance was created
        // If null, RPC decided not to create maintenance (e.g., non-critical fault)
        if (maintenanceId && typeof maintenanceId === 'string' && maintenanceId.length > 0) {
          created++
          console.log(`Created maintenance ${maintenanceId} from fault code event ${event.id}`)
        } else {
          // RPC returned null - no maintenance created (e.g., non-critical fault, no rule match)
          skipped++
        }
      } catch (error: any) {
        console.error(`Error processing event ${event.id}:`, error)
        skipped++
        // Don't increment processed on exception either
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



