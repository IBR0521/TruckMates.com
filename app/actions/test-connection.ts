"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export async function testSupabaseConnection() {
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















