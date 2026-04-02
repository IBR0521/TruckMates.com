"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import type { EmployeeRole } from "@/lib/roles"
import * as Sentry from "@sentry/nextjs"

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
  } catch (error: unknown) {
    return { 
      available: false, 
      error: String(errorMessage(error) || error || "Unknown error").substring(0, 200) 
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
    // BUG-045 FIX: Use explicit environment variable instead of NODE_ENV check
    // This prevents auto-confirmation in staging/QA environments
    try {
      if (process.env.NODE_ENV === "development" && process.env.ALLOW_AUTO_CONFIRM_EMAIL === "true") {
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
        Sentry.captureException(deleteError)
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
        Sentry.captureMessage(
          `[REGISTRATION] Failed to auto-enable platform integrations: ${integrationError.message}`,
          "warning",
        )
        // Don't fail registration if this fails - it's optional
      }
    } catch (error) {
      Sentry.captureException(error)
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
  } catch (error: unknown) {
    return { 
      data: null, 
      error: String(errorMessage(error) || error || "Registration failed").substring(0, 200) 
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
  invitationCode?: string
}) {
  try {
    const supabase = await createClient()

    const role = String(data.role).trim().toLowerCase() as EmployeeRole

    const ALLOWED_SELF_REGISTER_ROLES: EmployeeRole[] = ["dispatcher", "safety_compliance", "financial_controller", "driver"]
    const ALLOWED_INVITED_REGISTER_ROLES: EmployeeRole[] = [
      "operations_manager",
      "dispatcher",
      "safety_compliance",
      "financial_controller",
      "driver",
    ]

    // HIGH FIX: Require invite token for company registration
    let companyId: string | null = null

    // Normalize: trim whitespace; support code pasted in "company ID" field on older flows
    const inviteToken = String(
      (data.invitationCode ?? data.companyId ?? "").trim(),
    )

    if (inviteToken) {
      if (!ALLOWED_INVITED_REGISTER_ROLES.includes(role)) {
        return {
          data: null,
          error: `Invalid invited role: ${role}.`,
        }
      }

      // Check if it's an invitation code (6-digit or alphanumeric)
      // First try to find it in invitation_codes table
      const { data: invitation, error: inviteError } = await supabase
        .from("invitation_codes")
        .select("company_id, email, status, expires_at")
        .eq("invitation_code", inviteToken)
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
      if (!ALLOWED_SELF_REGISTER_ROLES.includes(role)) {
        return {
          data: null,
          error: `You cannot self-register as ${role}. Only ${ALLOWED_SELF_REGISTER_ROLES.join(", ")} roles can self-register.`,
        }
      }
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
    // BUG-045 FIX: Use explicit environment variable instead of NODE_ENV check
    // This prevents auto-confirmation in staging/QA environments
    try {
      if (process.env.NODE_ENV === "development" && process.env.ALLOW_AUTO_CONFIRM_EMAIL === "true") {
        const { createAdminClient } = await import("@/lib/supabase/admin")
        const adminSupabase = createAdminClient()
        await adminSupabase.auth.admin.updateUserById(authData.user.id, {
          email_confirm: true,
        })
      }
    } catch {
      // Ignore auto-confirm failure; Supabase will still enforce normal email confirmation
    }

    // Update user record with admin client so invited employee is reliably attached
    // to the target company even if normal RLS/session propagation is delayed.
    const updateData: any = {
      id: authData.user.id,
      email: data.email.toLowerCase(),
      full_name: data.fullName.trim(),
      role,
      company_id: companyId, // Use validated companyId from invitation
      employee_status: "active",
    }

    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminSupabase = createAdminClient()

    const { error: updateError } = await adminSupabase
      .from("users")
      .upsert(updateData, { onConflict: "id" })

    if (updateError) {
      const errorMsg = updateError.message || String(updateError) || "Failed to update user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    // If the joined user is a driver, create/update their `public.drivers` row so they
    // automatically appear in the Drivers list (and are treated as drivers elsewhere).
    if (role === "driver" && companyId) {
      try {
        const userId = String(authData.user.id)
        const companyIdStr = String(companyId)
        const normalizedEmail = data.email.toLowerCase().trim()
        const driverName = data.fullName.trim()

        const { data: existingDrivers } = await adminSupabase
          .from("drivers")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", companyIdStr)
          .limit(1)

        if (existingDrivers && existingDrivers.length > 0) {
          await adminSupabase
            .from("drivers")
            .update({
              name: driverName,
              email: normalizedEmail,
              phone: null,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("company_id", companyIdStr)
        } else {
          await adminSupabase.from("drivers").insert({
            user_id: userId,
            company_id: companyIdStr,
            name: driverName,
            email: normalizedEmail,
            phone: null,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e: unknown) {
        // Driver list would be incomplete, but we shouldn't break onboarding.
        Sentry.captureException(e)
      }
    }

    // Mark invitation as accepted only after user/company assignment succeeded.
    if (inviteToken) {
      const acceptPayload = {
        status: "accepted" as const,
        accepted_at: new Date().toISOString(),
        accepted_by: authData.user.id,
      }

      const { data: acceptedRows, error: acceptError } = await adminSupabase
        .from("invitation_codes")
        .update(acceptPayload)
        .eq("invitation_code", inviteToken)
        .eq("status", "pending")
        .select("id")

      if (acceptError) {
        return { data: null, error: acceptError.message.substring(0, 200) }
      }

      // Fallback: code mismatch (whitespace, copy/paste) but user+company already match invite email
      if (!acceptedRows || acceptedRows.length === 0) {
        const emailLower = data.email.toLowerCase()
        const { data: byEmail, error: byEmailError } = await adminSupabase
          .from("invitation_codes")
          .update(acceptPayload)
          .eq("company_id", companyId)
          .eq("email", emailLower)
          .eq("status", "pending")
          .select("id")

        if (byEmailError) {
          return { data: null, error: byEmailError.message.substring(0, 200) }
        }
        if (!byEmail?.length) {
          // Account exists; invitation row may still look "pending" until Manage Users runs reconciliation
          Sentry.captureMessage(
            `[registerEmployee] Invitation not marked accepted (companyId=${companyId}, email=${emailLower})`,
          )
        }
      }
    }

    return {
      data: {
        userId: String(authData.user.id),
        email: String(authData.user.email || ""),
        role: String(data.role),
      },
      error: null
    }
  } catch (error: unknown) {
    return { 
      data: null, 
      error: String(errorMessage(error) || error || "Registration failed").substring(0, 200) 
    }
  }
}

