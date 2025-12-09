"use server"

import { createClient } from "@/lib/supabase/server"

export async function getCurrentUser() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Try using the RPC function first (bypasses RLS)
  const { data: roleData, error: roleError } = await supabase.rpc("get_user_role_and_company")

  if (!roleError && roleData && roleData.length > 0) {
    // Get full user data using the role info
    const { data: userData, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error) {
      // If RPC worked but query failed, return basic info from RPC
      return { 
        data: { 
          id: user.id,
          email: user.email,
          role: roleData[0].role,
          company_id: roleData[0].company_id
        }, 
        error: null 
      }
    }

    return { data: { ...userData, email: user.email }, error: null }
  }

  // Fallback: try direct query (might fail due to RLS)
  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: { ...userData, email: user.email }, error: null }
}

