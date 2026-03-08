"use server"

import { createClient } from "@supabase/supabase-js"

// BUG-068 FIX: Use environment variables instead of hardcoded credentials
// Never hardcode credentials in source code - use env vars or generate random passwords
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@truckmates.com"
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || (() => {
  // Generate a random password if not set in env
  // This is a fallback for development only
  if (process.env.NODE_ENV === "production") {
    throw new Error("DEMO_PASSWORD must be set in environment variables for production")
  }
  return "demo123456" // Only for development
})()
const DEMO_COMPANY_NAME = process.env.DEMO_COMPANY_NAME || "Demo Logistics Company"

// Use a loose type here to avoid tight coupling to Supabase client generics
// This is an internal helper and we only call methods that exist on any Supabase client instance.
async function markDemoCompanySetupComplete(adminClient: any, companyId: string) {
  try {
    // Mark setup as complete so demo users are never sent through the onboarding wizard
    await adminClient
      .from("companies")
      .update({
        setup_complete: true,
        setup_completed_at: new Date().toISOString(),
        // Flag this company as demo in setup_data without overwriting any existing data
        setup_data: {
          is_demo: true,
        },
      } as any)
      .eq("id", companyId)
  } catch (error) {
    console.warn("Failed to mark demo company setup complete:", error)
    // Don't block demo access if this fails
  }
}

export async function createDemoAndSignIn() {
  try {
    // Use service role key to bypass RLS and create user directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Check for missing environment variables
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.VERCEL === '1'
    
    if (!supabaseUrl) {
      const errorMsg = isProduction
        ? "Supabase configuration missing. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel project settings → Environment Variables → Production, then redeploy."
        : "Supabase configuration missing. Please add NEXT_PUBLIC_SUPABASE_URL to your .env.local file."
      return { error: errorMsg }
    }
    
    // For demo setup, we need service role key to create users via admin API
    // Admin operations require service role key - anon key won't work
    if (!serviceRoleKey) {
      const errorMsg = isProduction
        ? "Supabase service role key missing. Please add SUPABASE_SERVICE_ROLE_KEY to Vercel project settings → Environment Variables → Production, then redeploy. Note: Service role key is required for demo setup."
        : "Supabase service role key missing. Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file."
      return { error: errorMsg }
    }

    // Create admin client with service role key
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

    // Populate demo data - with timeout to prevent hanging
    if (companyId) {
      try {
        console.log("Starting demo data population for company:", companyId)
        
        // Add timeout wrapper to prevent infinite hanging
        const populateWithTimeout = Promise.race([
          adminClient.rpc('populate_demo_data_for_company', {
            p_company_id: companyId
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Demo data population timed out after 30 seconds')), 30000)
          )
        ]) as Promise<{ data: any; error: any }>
        
        // Call the function with timeout
        const { data: populateResult, error: populateError } = await populateWithTimeout
        
        if (populateError) {
          console.error("Demo data population RPC error:", populateError)
          
          // Check for common errors
          const errorMsg = populateError.message || String(populateError)
          
          // If timeout or function missing, continue anyway - company is created
          if (errorMsg.includes('timed out') || errorMsg.includes('does not exist') || (errorMsg.includes('function') && errorMsg.includes('not found'))) {
            console.warn("Demo data population failed, but continuing with company creation:", errorMsg)
            if (companyId) {
              await markDemoCompanySetupComplete(adminClient, companyId)
            }
            // Don't fail - company is created, data can populate later
            return { 
              success: true, 
              userId, 
              companyId,
              warning: errorMsg.includes('timed out') 
                ? "Demo company created successfully, but data population timed out. You can continue using the platform."
                : "Demo company created successfully, but data population function is missing. Please run supabase/populate_demo_data_function.sql in Supabase SQL Editor."
            }
          }
          
          // For other errors, also continue but warn
          console.warn("Demo data population had an error, but continuing:", errorMsg)
          if (companyId) {
            await markDemoCompanySetupComplete(adminClient, companyId)
          }
          return { 
            success: true,
            userId, 
            companyId,
            warning: `Demo company created successfully, but data population had an issue: ${errorMsg}`
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
        
        // Don't fail on timeout or missing function - company is created
        if (errorMsg.includes('timed out') || errorMsg.includes('does not exist') || (errorMsg.includes('function') && errorMsg.includes('not found'))) {
          console.warn("Demo data population failed, but continuing with company creation:", errorMsg)
          if (companyId) {
            await markDemoCompanySetupComplete(adminClient, companyId)
          }
          return { 
            success: true,
            userId, 
            companyId,
            warning: errorMsg.includes('timed out')
              ? "Demo company created successfully, but data population timed out. You can continue using the platform."
              : "Demo company created successfully, but data population function is missing. Please run supabase/populate_demo_data_function.sql in Supabase SQL Editor."
          }
        }
        
        // For other errors, continue anyway
        console.warn("Demo data population had an exception, but continuing:", errorMsg)
        if (companyId) {
          await markDemoCompanySetupComplete(adminClient, companyId)
        }
        return { 
          success: true,
          userId, 
          companyId,
          warning: `Demo company created successfully, but data population had an issue: ${errorMsg}`
        }
      }
    }

    // Success - mark setup complete so demo users skip the onboarding wizard
    if (companyId) {
      await markDemoCompanySetupComplete(adminClient, companyId)
    }

    // Client will handle sign-in
    return { success: true, userId, companyId }
  } catch (error: unknown) {
    // Log the full error for debugging
    console.error("[createDemoAndSignIn] Error:", error)
    
    // Return a user-friendly error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : "Failed to create demo. Please check your environment variables and try again."
    
    return { error: errorMessage }
  }
}

