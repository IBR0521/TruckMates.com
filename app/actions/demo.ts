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

    // Get user record if userId is provided
    let userRecord = null
    if (userId) {
      const { data } = await supabase
        .from("users")
        .select("id, company_id, role")
        .eq("id", userId)
        .maybeSingle()
      userRecord = data
    }

    let companyId: string | null = null

    if (userRecord?.company_id) {
      companyId = userRecord.company_id
    } else {
      // Create demo company if it doesn't exist
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("name", DEMO_COMPANY_NAME)
        .maybeSingle()

      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        // Create new demo company
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
          return { error: companyError?.message || "Failed to create demo company", data: null }
        }

        companyId = newCompany.id
      }

      // Create or update user record (only if we have userId)
      if (userId) {
        if (!userRecord) {
          const { error: userError } = await supabase
            .from("users")
            .insert({
              id: userId,
              email: DEMO_EMAIL,
              full_name: "Demo User",
              role: "manager",
              company_id: companyId,
              phone: "+1-555-DEMO",
            })

          if (userError) {
            console.error("Error creating user record:", userError)
            // Don't fail - user might be created by trigger
          }
        } else {
          // Update existing user record
          const { error: updateError } = await supabase
            .from("users")
            .update({
              company_id: companyId,
              role: "manager",
            })
            .eq("id", userId)

          if (updateError) {
            console.error("Error updating user record:", updateError)
            // Don't fail - continue with setup
          }
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
