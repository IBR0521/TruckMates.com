"use server"

import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { isDevSurfaceBlocked } from "@/lib/security/dev-only"
export async function testSupabaseConnection() {
  if (isDevSurfaceBlocked()) {
    return {
      success: false,
      error: "Not found",
      details: "This endpoint is disabled in production.",
    }
  }

  try {
    const supabase = await createClient()
    
    // Simple test query
    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
    
    if (error) {
      return {
        success: false,
        error: safeDbError(error),
        details: "Database query failed. Check your Supabase configuration."
      }
    }
    
    return {
      success: true,
      message: "Connection successful"
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: errorMessage(error, "Unknown error"),
      details: "Failed to connect to Supabase. Check your environment variables."
    }
  }
}


