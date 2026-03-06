"use server"

import { createClient } from "@/lib/supabase/server"
import type { EmployeeRole } from "@/lib/roles"

/**
 * Check if company name is available
 * Returns only plain JSON-serializable data
 */
export async function checkCompanyName(companyName: string) {
  try {
    const supabase = await createClient()
    
    const result = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName.trim())
      .maybeSingle()

    const exists = result.data !== null && result.data !== undefined
    const errorMsg = result.error ? String(result.error.message || result.error) : null

    if (errorMsg) {
      return { available: false, error: errorMsg.substring(0, 200) }
    }

    return { available: !exists, error: null }
  } catch (error: any) {
    return { 
      available: false, 
      error: String(error?.message || error || "Unknown error").substring(0, 200) 
    }
  }
}

/**
 * Register super admin and create company
 * Returns only plain JSON-serializable data
 */
export async function registerSuperAdmin(data: {
  companyName: string
  email: string
  phone: string
  password: string
  companyType?: 'broker' | 'carrier' | 'both' | null
}) {
  try {
    const supabase = await createClient()

    // Step 1: Check company name availability
    const nameCheck = await checkCompanyName(data.companyName)
    if (nameCheck.error) {
      return { data: null, error: nameCheck.error }
    }
    if (!nameCheck.available) {
      return { data: null, error: "Company name already exists" }
    }

    // Step 2: Create auth user with employee_role in metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.companyName.trim(),
          role: 'super_admin',
          employee_role: 'super_admin' // Set in auth metadata for role-based access
        }
      }
    })

    if (authError || !authData.user) {
      const errorMsg = authError?.message || String(authError) || "Failed to create user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    // DEV-ONLY: Auto-confirm email so local accounts can log in without waiting for email
    try {
      if (process.env.NODE_ENV !== "production") {
        const { createAdminClient } = await import("@/lib/supabase/admin")
        const adminSupabase = createAdminClient()
        await adminSupabase.auth.admin.updateUserById(authData.user.id, {
          email_confirm: true,
        })
      }
    } catch {
      // Ignore auto-confirm failure; Supabase will still enforce normal email confirmation
    }

    // Step 3: Create company using RPC function (bypasses RLS)
    const rpcResult = await supabase.rpc('create_company_for_user', {
      p_name: data.companyName.trim(),
      p_email: data.email,
      p_phone: data.phone,
      p_user_id: authData.user.id,
      p_company_type: data.companyType || null
    })

    // Handle RPC errors - ensure error is serializable
    // SEC-005 FIX: If company creation fails, delete orphaned auth user to prevent account lockout
    if (rpcResult.error) {
      const errorMsg = rpcResult.error?.message || String(rpcResult.error) || "Failed to create company"
      
      // SEC-005: Delete orphaned auth user if company creation failed
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin")
        const adminSupabase = createAdminClient()
        await adminSupabase.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error('[REGISTRATION] Failed to delete orphaned auth user:', deleteError)
        // Continue even if deletion fails - log the error
      }
      
      return { data: null, error: String(errorMsg).substring(0, 200) }
    }

    // Get company ID and convert to string immediately
    const companyIdRaw = rpcResult.data
    if (!companyIdRaw) {
      return { data: null, error: "Failed to create company: No company ID returned" }
    }

    // Convert to string - handle both UUID and TEXT return types
    const companyId = typeof companyIdRaw === 'string' ? companyIdRaw : String(companyIdRaw)

    // Step 4: Auto-enable platform integrations (Google Maps, Email Service)
    // These use platform-wide API keys and work automatically for all users
    try {
      const { error: integrationError } = await supabase.rpc('auto_enable_platform_integrations', {
        p_company_id: companyId
      })
      if (integrationError) {
        console.warn('[REGISTRATION] Failed to auto-enable platform integrations:', integrationError.message)
        // Don't fail registration if this fails - it's optional
      }
    } catch (error) {
      console.warn('[REGISTRATION] Error enabling platform integrations:', error)
      // Don't fail registration if this fails
    }

    // Step 5: Return success without fetching company (avoid Date serialization issues)
    // The RPC function already created everything, we just need to return success
    const result = {
      data: {
        userId: String(authData.user.id),
        companyId: String(companyId),
        companyName: String(data.companyName.trim()),
        email: String(data.email),
        phone: String(data.phone || ""),
      },
      error: null
    }

    // Final safety: ensure JSON serializable by double-serializing
    try {
      return JSON.parse(JSON.stringify(result))
    } catch {
      // If JSON serialization fails, return minimal safe data
      return {
        data: {
          userId: String(authData.user.id),
          companyId: String(companyId),
          companyName: String(data.companyName.trim()),
          email: String(data.email),
          phone: String(data.phone || ""),
        },
        error: null
      }
    }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Registration failed").substring(0, 200) 
    }
  }
}

/**
 * Register employee (joins existing company)
 * Returns only plain JSON-serializable data
 */
export async function registerEmployee(data: {
  fullName: string
  email: string
  password: string
  role: string
  companyId?: string
}) {
  try {
    const supabase = await createClient()

    const role = data.role as EmployeeRole

    // HIGH FIX 5: Use allowlist instead of blocklist for role validation
    const ALLOWED_SELF_REGISTER_ROLES: EmployeeRole[] = ["dispatcher", "safety_compliance", "financial_controller", "driver"]
    if (!ALLOWED_SELF_REGISTER_ROLES.includes(role)) {
      return {
        data: null,
        error: `You cannot self-register as ${role}. Only ${ALLOWED_SELF_REGISTER_ROLES.join(", ")} roles can self-register.`,
      }
    }

    // HIGH FIX: Require invite token for company registration
    // Check if invitation_code table exists, if not fall back to companyId validation
    let companyId: string | null = null
    
    // Try to get invitation token from data (could be passed as invitationCode or companyId)
    const invitationCode = (data as any).invitationCode || data.companyId
    
    if (invitationCode) {
      // Check if it's an invitation code (UUID format or alphanumeric)
      // First try to find it in invitation_codes table
      const { data: invitation, error: inviteError } = await supabase
        .from("invitation_codes")
        .select("company_id, email, status, expires_at")
        .eq("invitation_code", invitationCode)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle()

      if (!inviteError && invitation) {
        // Valid invitation code found
        companyId = invitation.company_id
        
        // Verify email matches if email was provided in invitation
        if (invitation.email && invitation.email.toLowerCase() !== data.email.toLowerCase()) {
          return { 
            data: null, 
            error: "This invitation was sent to a different email address. Please use the email address the invitation was sent to." 
          }
        }
      } else {
        // BUG-013 FIX: Remove backward compatibility that allows direct company_id UUID
        // This was a security hole - anyone could register to any company by guessing UUIDs
        return { 
          data: null, 
          error: "Invalid invitation code. Please use a valid invitation link or contact your administrator." 
        }
      }
    } else {
      return { 
        data: null, 
        error: "Invitation code or company ID is required. Please use a valid invitation link." 
      }
    }

    if (!companyId) {
      return { 
        data: null, 
        error: "Invalid invitation. Please use a valid invitation link or contact your administrator." 
      }
    }

    // Create auth user with employee_role in metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName.trim(),
          role,
          employee_role: role, // Set in auth metadata for role-based access
        }
      }
    })

    if (authError || !authData.user) {
      const errorMsg = authError?.message || String(authError) || "Failed to create user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    // DEV-ONLY: Auto-confirm email so invited accounts can log in without waiting for email
    try {
      if (process.env.NODE_ENV !== "production") {
        const { createAdminClient } = await import("@/lib/supabase/admin")
        const adminSupabase = createAdminClient()
        await adminSupabase.auth.admin.updateUserById(authData.user.id, {
          email_confirm: true,
        })
      }
    } catch {
      // Ignore auto-confirm failure; Supabase will still enforce normal email confirmation
    }

    // Update user record
    const updateData: any = {
      full_name: data.fullName.trim(),
      role,
      company_id: companyId, // Use validated companyId from invitation
    }
    
    // BUG FIX: invitationCode already declared above, reuse it instead of redeclaring
    // If invitation code was used, mark it as accepted
    // invitationCode is already defined on line 168, so we can use it here
    if (invitationCode && typeof invitationCode === 'string') {
      await supabase
        .from("invitation_codes")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by: authData.user.id,
        })
        .eq("invitation_code", invitationCode)
        .eq("status", "pending")
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authData.user.id)

    if (updateError) {
      const errorMsg = updateError.message || String(updateError) || "Failed to update user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    return {
      data: {
        userId: String(authData.user.id),
        email: String(authData.user.email || ""),
        role: String(data.role),
      },
      error: null
    }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Registration failed").substring(0, 200) 
    }
  }
}

