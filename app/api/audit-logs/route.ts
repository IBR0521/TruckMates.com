import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const resourceType = searchParams.get("resource_type")
    const resourceId = searchParams.get("resource_id")
    const limit = parseInt(searchParams.get("limit") || "50")
    
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: "No company found" }, { status: 403 })
    }

    // Build query - fetch audit logs first
    let query = supabase
      .from("audit_logs")
      .select(`
        id,
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        created_at,
        ip_address,
        user_agent
      `)
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (resourceType) {
      query = query.eq("resource_type", resourceType)
    }

    if (resourceId) {
      query = query.eq("resource_id", resourceId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[Audit Logs API] Error fetching audit logs:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        resourceType,
        resourceId
      })
      return NextResponse.json({ 
        error: error.message,
        code: error.code,
        details: error.details 
      }, { status: 500 })
    }

    console.log("[Audit Logs API] Found", data?.length || 0, "logs for", resourceType, resourceId)

    // Fetch user names separately if we have logs
    const userIds = [...new Set((data || []).map((log: any) => log.user_id).filter(Boolean))]
    const userMap: Record<string, { name?: string; email?: string }> = {}
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", userIds)
      
      if (!usersError && users) {
        users.forEach((user: any) => {
          userMap[user.id] = { name: user.name, email: user.email }
        })
      }
    }

    // Format response with user names
    const logs = (data || []).map((log: any) => ({
      id: log.id,
      user_id: log.user_id,
      user_name: userMap[log.user_id]?.name || userMap[log.user_id]?.email || "Unknown User",
      action: log.action,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      details: log.details || {},
      created_at: log.created_at,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
    }))

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error("Error in audit logs API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

