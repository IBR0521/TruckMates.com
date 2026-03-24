"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"

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
        error: error.message,
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















