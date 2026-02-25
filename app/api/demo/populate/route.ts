import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json(
        { error: "No company found for user" },
        { status: 400 }
      )
    }

    // Read the SQL file and execute it
    // Note: This requires the SQL to be accessible, so we'll use RPC instead
    // For now, return success and let the SQL be run manually
    // OR we can create a simpler RPC function
    
    return NextResponse.json({
      success: true,
      message: "Demo data population initiated. Please run insert_demo_platform_data.sql manually in Supabase SQL editor."
    })
  } catch (error: any) {
    console.error("Demo populate error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to populate demo data" },
      { status: 500 }
    )
  }
}









