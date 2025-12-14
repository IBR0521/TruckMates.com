"use server"

import { createClient } from "@/lib/supabase/server"

const DEMO_EMAIL = "demo@truckmates.com"
const DEMO_PASSWORD = "demo123456"
const DEMO_COMPANY_NAME = "Demo Logistics Company"

export async function createDemoAccount() {
  const supabase = await createClient()

  try {
    // Try to sign in first (demo user might already exist)
    let userId: string
    let isNewUser = false

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })

    if (signInError || !signInData.user) {
      // User doesn't exist, create demo user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        options: {
          emailRedirectTo: undefined,
          data: {
            is_demo: true
          }
        }
      })

      if (signUpError || !signUpData.user) {
        return { 
          error: signUpError?.message || "Failed to create demo account", 
          data: null 
        }
      }

      userId = signUpData.user.id
      isNewUser = true
    } else {
      userId = signInData.user.id
    }

    // Wait a bit for user record to be created by trigger
    if (isNewUser) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Check if user record exists in users table
    const { data: userRecord } = await supabase
      .from("users")
      .select("id, company_id, role")
      .eq("id", userId)
      .maybeSingle()

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

      // Create or update user record
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

    // Return success - sign in will be handled on client side
    return { 
      data: { 
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        company_id: companyId 
      }, 
      error: null 
    }
  } catch (error: any) {
    console.error("Demo account creation error:", error)
    return { error: error.message || "Failed to create demo account", data: null }
  }
}
