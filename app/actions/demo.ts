"use server"

import { createClient } from "@/lib/supabase/server"

const DEMO_COMPANY_NAME = "Demo Logistics Company"

// Setup demo company for a user
// This is called AFTER the user is signed in on the client side
// Platform is now free - no subscription needed
export async function setupDemoCompany(userId: string | null) {
  try {
    // Create Supabase client - simplified, no try-catch wrapper
    const supabase = await createClient()
    
    if (!supabase) {
      return { 
        error: "Failed to initialize database connection. Please check your Supabase configuration.", 
        data: null 
      }
    }

    // Get authenticated user - simplified timeout
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    // If no authenticated user but userId provided, try to proceed anyway
    // (This handles cases where email confirmation is pending)
    let actualUserId: string | null = userId
    let userEmail = ""
    
    if (authUser) {
      actualUserId = userId || authUser.id
      userEmail = authUser.email || ""
    } else if (!userId) {
      // No user ID and no auth - can't proceed
      return {
        error: "User not authenticated. Please sign in first or wait for email confirmation.",
        data: null
      }
    } else {
      // userId provided but no auth session - try to get user email from users table
      const { data: userData } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId)
        .maybeSingle()
      userEmail = userData?.email || "demo@truckmates.com"
    }

    // Ensure user record exists in users table
    if (actualUserId) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, company_id, role, email")
        .eq("id", actualUserId)
        .maybeSingle()
      
      // If user doesn't exist in users table, create it
      if (!existingUser) {
        const { error: insertError } = await supabase
          .from("users")
          .insert({
            id: actualUserId,
            email: userEmail || "demo@truckmates.com",
            role: "super_admin",
            full_name: "Demo User"
          })
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error("Error creating user record:", insertError)
        }
      }
    }

    // Get user record - simplified query
    const { data: userRecord } = await supabase
      .from("users")
      .select("id, company_id, role")
      .eq("id", actualUserId)
      .maybeSingle()

    let companyId: string | null = null

    if (userRecord?.company_id) {
      // CRITICAL FIX: Check if user is linked to a demo company
      const { data: company } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", userRecord.company_id)
        .single()
      
      // If linked to demo company, don't use it - create a new one instead
      if (company?.name === DEMO_COMPANY_NAME || company?.name?.includes("Demo Logistics Company")) {
        // User is linked to demo company - create a new unique company for them
        const { data: newCompanyId, error: rpcError } = await supabase.rpc('create_company_for_user', {
          p_name: `${DEMO_COMPANY_NAME} (${userEmail})`,
          p_email: userEmail,
          p_phone: "+1-555-DEMO",
          p_user_id: actualUserId,
          p_company_type: null
        })
        
        if (rpcError) {
          return { 
            error: `Failed to create demo company: ${rpcError.message}`, 
            data: null 
          }
        }
        
        companyId = newCompanyId
      } else {
        // User has a real company - use it
        companyId = userRecord.company_id
        // Update role to super_admin for demo
        await supabase
          .from("users")
          .update({ role: "super_admin" })
          .eq("id", actualUserId)
        
        // Update auth metadata
        await supabase.auth.updateUser({
          data: {
            role: "super_admin",
          }
        })
      }
    } else if (actualUserId) {
      // CRITICAL FIX: Never link users to existing demo companies
      // Each demo setup should create its own company to prevent data leaks
      // Use RPC function to create a NEW company for this user (bypasses RLS)
      const { data: newCompanyId, error: rpcError } = await supabase.rpc('create_company_for_user', {
        p_name: `${DEMO_COMPANY_NAME} (${userEmail})`, // Make it unique per user
        p_email: userEmail,
        p_phone: "+1-555-DEMO",
        p_user_id: actualUserId,
        p_company_type: null
      })

      if (rpcError) {
        return { 
          error: `Failed to create demo company: ${rpcError.message}. Please ensure create_company_for_user function exists in Supabase.`, 
          data: null 
        }
      }

      companyId = newCompanyId
    }

    // Platform is now free - no subscription needed

    // Automatically populate demo data (non-blocking - don't fail if this errors)
    if (companyId) {
      // Run in background - don't wait for it
      supabase.rpc('populate_demo_data_for_company', {
        p_company_id: companyId
      }).catch(() => {
        // Silently fail - company is created, data can populate later
      })
    }

    // Return success
    return { 
      data: { 
        company_id: companyId 
      }, 
      error: null 
    }
  } catch (error: any) {
    // Return detailed error for debugging
    const errorMessage = error?.message || String(error) || "Failed to setup demo company"
    
    // Provide helpful error messages
    if (errorMessage.includes("Missing Supabase") || errorMessage.includes("NEXT_PUBLIC_SUPABASE")) {
      return {
        error: "Supabase configuration missing. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
        data: null
      }
    }
    
    if (errorMessage.includes("connect") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("timeout")) {
      return {
        error: "Failed to connect to Supabase. Please check:\n1. Your internet connection\n2. Supabase project is active (not paused)\n3. Environment variables are correct",
        data: null
      }
    }
    
    return { 
      error: `Demo setup failed: ${errorMessage}`, 
      data: null 
    }
  }
}
