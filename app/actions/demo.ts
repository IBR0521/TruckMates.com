"use server"

import { createClient } from "@/lib/supabase/server"

const DEMO_EMAIL = "demo@truckmates.com"
const DEMO_COMPANY_NAME = "Demo Logistics Company"

// Setup demo company and subscription for a user
// This is called AFTER the user is signed in on the client side
export async function setupDemoCompany(userId: string | null) {
  try {
    // Create Supabase client
    const supabase = await createClient()
    
    if (!supabase) {
      return { 
        error: "Failed to initialize database connection. Please check your Supabase configuration.", 
        data: null 
      }
    }

    // Verify user is authenticated
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser) {
      return {
        error: "User not authenticated. Please sign in first.",
        data: null
      }
    }

    // Use authenticated user ID (from session) if userId not provided
    const actualUserId = userId || authUser.id

    // Get user record
    let userRecord = null
    if (actualUserId) {
      const { data } = await supabase
        .from("users")
        .select("id, company_id, role")
        .eq("id", actualUserId)
        .maybeSingle()
      userRecord = data
    }

    let companyId: string | null = null

    if (userRecord?.company_id) {
      companyId = userRecord.company_id
    } else if (actualUserId) {
      // Check if demo company already exists
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("name", DEMO_COMPANY_NAME)
        .maybeSingle()

      if (existingCompany) {
        companyId = existingCompany.id
        // Link user to existing company
        const { error: updateError } = await supabase
          .from("users")
          .update({
            company_id: companyId,
            role: "manager",
          })
          .eq("id", actualUserId)

        if (updateError) {
          console.error("Error linking user to existing company:", updateError)
        }
      } else {
        // Use RPC function to create company (bypasses RLS)
        const { data: newCompanyId, error: rpcError } = await supabase.rpc('create_company_for_user', {
          p_name: DEMO_COMPANY_NAME,
          p_email: DEMO_EMAIL,
          p_phone: "+1-555-DEMO",
          p_user_id: actualUserId
        })

        if (rpcError) {
          console.error("RPC function error, trying fallback:", rpcError.message)
          
          // Fallback: Try direct insert (might fail due to RLS, but worth trying)
          const { data: newCompany, error: companyError } = await supabase
            .from("companies")
            .insert({
              name: DEMO_COMPANY_NAME,
              email: DEMO_EMAIL,
              phone: "+1-555-DEMO",
            })
            .select()
            .single()

          if (companyError || !newCompany) {
            return { 
              error: `Failed to create demo company: ${companyError?.message || rpcError.message}. Please check RLS policies.`, 
              data: null 
            }
          }

          companyId = newCompany.id

          // Link user to company
          if (!userRecord) {
            const { error: userError } = await supabase
              .from("users")
              .insert({
                id: actualUserId,
                email: DEMO_EMAIL,
                full_name: "Demo User",
                role: "manager",
                company_id: companyId,
                phone: "+1-555-DEMO",
              })

            if (userError) {
              console.error("Error creating user record:", userError)
            }
          } else {
            const { error: updateError } = await supabase
              .from("users")
              .update({
                company_id: companyId,
                role: "manager",
              })
              .eq("id", actualUserId)

            if (updateError) {
              console.error("Error updating user record:", updateError)
            }
          }
        } else {
          companyId = newCompanyId
        }
      }
    }

    // Ensure demo company has a subscription (free trial)
    if (companyId) {
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle()

      if (!existingSubscription) {
        // Create a free trial subscription for demo
        const { error: subError } = await supabase
          .from("subscriptions")
          .insert({
            company_id: companyId,
            plan_id: "simple", // Free tier
            status: "active",
            trial_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          })

        if (subError) {
          console.error("Error creating demo subscription:", subError)
        }
      }
    }

    // Return success
    return { 
      data: { 
        company_id: companyId 
      }, 
      error: null 
    }
  } catch (error: any) {
    console.error("Demo company setup error:", error)
    // Return detailed error for debugging
    const errorMessage = error?.message || String(error) || "Failed to setup demo company"
    return { 
      error: `Demo company setup failed: ${errorMessage}. Please check server logs for details.`, 
      data: null 
    }
  }
}
