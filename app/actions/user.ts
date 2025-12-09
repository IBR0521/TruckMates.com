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

  // Try using the RPC function first (bypasses RLS) - but handle if it doesn't exist
  let roleData: any = null
  let roleError: any = null
  
  try {
    const result = await supabase.rpc("get_user_role_and_company")
    roleData = result.data
    roleError = result.error
  } catch (error) {
    // RPC function might not exist, that's okay - we'll use fallback
    roleError = error
  }

  if (!roleError && roleData && Array.isArray(roleData) && roleData.length > 0) {
    // Get full user data - try query, but if it fails, return what we have from RPC
    const { data: userData, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error) {
      // If query failed, return basic info from RPC
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

  // Fallback: try direct query (might fail due to RLS, but worth trying)
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

