"use server"

import { createClient } from "@/lib/supabase/server"

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
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error",
      details: "Failed to connect to Supabase. Check your environment variables."
    }
  }
}








