"use server"

import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const DEMO_EMAIL = "demo@truckmates.com"
const DEMO_PASSWORD = "demo123456"
const DEMO_COMPANY_NAME = "Demo Logistics Company"

export async function createDemoAndSignIn() {
  try {
    // Use service role key to bypass RLS and create user directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return { error: "Supabase configuration missing" }
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if demo user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const demoUser = existingUsers.users.find(u => u.email === DEMO_EMAIL)

    let userId: string

    if (demoUser) {
      // User exists - use existing user
      userId = demoUser.id
      
      // Update user metadata and FORCE email confirmation
      await adminClient.auth.admin.updateUserById(userId, {
        email_confirm: true, // Force confirm email - no confirmation needed
        user_metadata: {
          is_demo: true,
          role: 'super_admin'
        }
      })
    } else {
      // Create new demo user with email already confirmed
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true, // Auto-confirm email - no confirmation needed
        user_metadata: {
          is_demo: true,
          role: 'super_admin'
        }
      })

      if (createError || !newUser.user) {
        return { error: `Failed to create demo user: ${createError?.message || "Unknown error"}` }
      }

      userId = newUser.user.id
      
      // Double-check email is confirmed
      if (!newUser.user.email_confirmed_at) {
        await adminClient.auth.admin.updateUserById(userId, {
          email_confirm: true
        })
      }
    }

    // Ensure user exists in users table
    const { data: userRecord } = await adminClient
      .from("users")
      .select("id, company_id")
      .eq("id", userId)
      .maybeSingle()

    if (!userRecord) {
      await adminClient
        .from("users")
        .insert({
          id: userId,
          email: DEMO_EMAIL,
          role: "super_admin",
          full_name: "Demo User"
        })
    }

    // Get or create demo company
    let companyId: string | null = userRecord?.company_id || null

    if (!companyId) {
      // Check if demo company exists
      const { data: existingCompany } = await adminClient
        .from("companies")
        .select("id")
        .eq("name", DEMO_COMPANY_NAME)
        .maybeSingle()

      if (existingCompany) {
        companyId = existingCompany.id
      } else {
        // Create company using RPC function
        const { data: newCompanyId, error: rpcError } = await adminClient.rpc('create_company_for_user', {
          p_name: DEMO_COMPANY_NAME,
          p_email: DEMO_EMAIL,
          p_phone: "+1-555-DEMO",
          p_user_id: userId,
          p_company_type: null
        })

        if (rpcError) {
          // If RPC fails, try direct insert as fallback
          const { data: directCompany, error: directError } = await adminClient
            .from("companies")
            .insert({
              name: DEMO_COMPANY_NAME,
              email: DEMO_EMAIL,
              phone: "+1-555-DEMO"
            })
            .select("id")
            .single()

          if (directError || !directCompany) {
            return { error: `Failed to create company: ${rpcError.message || directError?.message}` }
          }

          companyId = directCompany.id
        } else {
          companyId = newCompanyId
        }
      }

      // Link user to company
      await adminClient
        .from("users")
        .update({ company_id: companyId, role: "super_admin" })
        .eq("id", userId)
    }

    // Populate demo data - WAIT for it to complete (this is important!)
    if (companyId) {
      try {
        console.log("Starting demo data population for company:", companyId)
        
        // Call the function and WAIT for it
        const { data: populateResult, error: populateError } = await adminClient.rpc('populate_demo_data_for_company', {
          p_company_id: companyId
        })
        
        if (populateError) {
          console.error("Demo data population RPC error:", populateError)
          
          // Check for common errors
          const errorMsg = populateError.message || String(populateError)
          
          if (errorMsg.includes('does not exist') || errorMsg.includes('function') && errorMsg.includes('not found')) {
            return { 
              error: `❌ The populate_demo_data_for_company function is missing in Supabase!\n\nPlease run this SQL file in your Supabase SQL Editor:\n\nsupabase/populate_demo_data_function.sql\n\nAfter running it, try the demo again.`,
              userId,
              companyId
            }
          }
          
          return { 
            error: `Demo company created but data population failed:\n\n${errorMsg}\n\nPlease check if populate_demo_data_for_company function exists in Supabase.`,
            userId,
            companyId
          }
        }
        
        // Check if result indicates success
        if (populateResult) {
          if (typeof populateResult === 'object' && 'success' in populateResult && !populateResult.success) {
            return {
              error: `Demo data population failed: ${populateResult.error || 'Unknown error'}`,
              userId,
              companyId
            }
          }
          // Log the result with counts
          if (typeof populateResult === 'object' && 'counts' in populateResult) {
            const counts = populateResult.counts as any
            console.log(`✅ Demo data populated:`, {
              drivers: counts.drivers || 0,
              trucks: counts.trucks || 0,
              loads: counts.loads || 0,
              routes: counts.routes || 0,
              customers: counts.customers || 0,
              invoices: counts.invoices || 0
            })
            
            // If no data was created, warn
            if ((counts.drivers || 0) === 0 && (counts.loads || 0) === 0) {
              console.warn("⚠️ Warning: Function returned success but no data was created. This might mean data already exists or there was an issue.")
            }
          } else {
            console.log("✅ Demo data populated successfully:", populateResult)
          }
        } else {
          console.warn("⚠️ Demo data population returned no result")
        }
      } catch (err: any) {
        console.error("Demo data population exception:", err)
        
        const errorMsg = err?.message || String(err)
        
        // Check if it's a "function doesn't exist" error
        if (errorMsg.includes('does not exist') || (errorMsg.includes('function') && errorMsg.includes('not found'))) {
          return { 
            error: `❌ The populate_demo_data_for_company function is missing in Supabase!\n\nPlease run this SQL file in your Supabase SQL Editor:\n\nsupabase/populate_demo_data_function.sql\n\nAfter running it, try the demo again.`,
            userId,
            companyId
          }
        }
        
        return { 
          error: `Demo company created but data population failed:\n\n${errorMsg}\n\nPlease check if populate_demo_data_for_company function exists in Supabase.`,
          userId,
          companyId
        }
      }
    }

    // Success - client will handle sign-in
    return { success: true, userId, companyId }
  } catch (error: any) {
    return { error: error?.message || "Failed to create demo" }
  }
}

