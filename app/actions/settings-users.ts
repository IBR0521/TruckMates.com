"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import type { EmployeeRole } from "@/lib/roles"
import * as Sentry from "@sentry/nextjs"

const MANAGER_ROLES: readonly EmployeeRole[] = ["super_admin", "operations_manager"]

export async function getCompanyUsers() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const role = await getUserRole()
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can view company users", data: null }
    }

    // Get all users in the company
    const { data: users, error } = await supabase
      .from("users")
      .select("id, email, full_name, phone, role, created_at")
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    // Map to include status (active by default)
    const usersWithStatus = users.map((u: { id: string; email: string; full_name: string | null; phone: string | null; role: string; created_at: string; [key: string]: any }) => ({
      ...u,
      status: "Active", // You can add a status field to users table if needed
    }))

    return { data: usersWithStatus, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null }
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", success: false }
    }

    const role = await getUserRole()
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can update user roles", success: false }
    }

    // Validate newRole against exact 6 roles
    const VALID_ROLES = ["super_admin", "operations_manager", "dispatcher", "safety_compliance", "financial_controller", "driver"]
    if (!VALID_ROLES.includes(newRole)) {
      return { error: `Invalid role: ${newRole}. Must be one of: ${VALID_ROLES.join(", ")}`, success: false }
    }

    // Prevent self-promotion to super_admin
    if (userId === ctx.userId && newRole === "super_admin") {
      return { error: "You cannot promote yourself to super_admin", success: false }
    }

    // Prevent assigning role higher than caller's role
    const roleHierarchy: Record<string, number> = {
      driver: 1,
      dispatcher: 2,
      safety_compliance: 2,
      financial_controller: 2,
      operations_manager: 3,
      super_admin: 4,
    }
    const callerLevel = roleHierarchy[role] || 0
    const targetLevel = roleHierarchy[newRole] || 0
    if (targetLevel > callerLevel) {
      return { error: `You cannot assign a role higher than your own (${role})`, success: false }
    }

    // Update user role in database
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId)
      .eq("company_id", ctx.companyId) // Ensure user is in same company

    if (error) {
      return { error: error.message, success: false }
    }

    // SECURITY: Also update auth metadata to keep role in sync (requires admin client)
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const adminSupabase = createAdminClient()

      const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          employee_role: newRole,
          role: newRole, // Keep both for compatibility
        },
      })

      if (authError) {
        Sentry.captureException(authError)
        // Don't fail the request, but log the error
        // The role is still updated in the database
      }
    } catch (error) {
      Sentry.captureException(error)
      // Continue - role is still updated in database
    }

    revalidatePath("/dashboard/settings/users")
    return { success: true, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { success: false, error: errorMessage(error, "An unexpected error occurred") }
  }
}

export async function removeUser(userId: string) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", success: false }
    }

    const role = await getUserRole()
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can remove users", success: false }
    }

    // Prevent removing yourself
    if (userId === ctx.userId) {
      return { error: "You cannot remove yourself", success: false }
    }

    // Check if user is in same company
    const { data: targetUser, error: targetUserError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle()

    if (targetUserError) {
      return { error: targetUserError.message, success: false }
    }

    if (targetUser?.company_id !== ctx.companyId) {
      return { error: "User not found in your company", success: false }
    }

    // Delete user (this will cascade delete related records)
    // Defense-in-depth: Add company_id to DELETE query
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", userId)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: error.message, success: false }
    }

    // MEDIUM FIX 15: Also delete auth account to prevent ghost accounts
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const adminSupabase = createAdminClient()

      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId)

      if (deleteError) {
        Sentry.captureException(deleteError)
        // Don't fail the request, but log the error
      }
    } catch (error) {
      Sentry.captureException(error)
    }

    revalidatePath("/dashboard/settings/users")
    return { success: true, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { success: false, error: errorMessage(error, "An unexpected error occurred") }
  }
}

/**
 * Invite a new user to the company
 */
export async function inviteUser(data: {
  email: string
  role: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can invite users", data: null }
  }

  // Fetch inviter full_name for email (optional)
  const { data: inviterProfile, error: inviterProfileError } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", ctx.userId!)
    .maybeSingle()

  if (inviterProfileError) {
    return { error: inviterProfileError.message, data: null }
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    return { error: "Invalid email address", data: null }
  }

  // Validate role: exact 6 roles only
  const VALID_ROLES = ["super_admin", "operations_manager", "dispatcher", "safety_compliance", "financial_controller", "driver"]
  if (!VALID_ROLES.includes(data.role)) {
    return { error: `Invalid role: ${data.role}. Must be one of: ${VALID_ROLES.join(", ")}`, data: null }
  }

  // Check if user already exists with this email
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, company_id")
    .eq("email", data.email.toLowerCase())
    .maybeSingle()

  if (existingUser) {
    if (existingUser.company_id === ctx.companyId) {
      return { error: "A user with this email already exists in your company", data: null }
    } else {
      return { error: "A user with this email already exists in another company", data: null }
    }
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvitation } = await supabase
    .from("invitation_codes")
    .select("id, status")
    .eq("email", data.email.toLowerCase())
    .eq("company_id", ctx.companyId)
    .eq("status", "pending")
    .maybeSingle()

  if (existingInvitation) {
    return { error: "An invitation has already been sent to this email address", data: null }
  }

  // BUG-061 FIX: Check subscription plan limits before inviting user
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select(`
      plan_id,
      subscription_plans!inner(max_users)
    `)
    .eq("company_id", ctx.companyId)
    .eq("status", "active")
    .maybeSingle()

  if (subscriptionError) {
    return { error: subscriptionError.message, data: null }
  }

  if (subscription?.subscription_plans?.max_users) {
    // Count current active users
    const { count: currentUserCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .eq("employee_status", "active")

    if (currentUserCount !== null && currentUserCount >= subscription.subscription_plans.max_users) {
      return {
        error: `User limit reached. Your plan allows ${subscription.subscription_plans.max_users} users. Please upgrade your subscription to invite more users.`,
        data: null
      }
    }
  }

  // Generate unique invitation code
  const invitationCode = crypto.randomUUID()

  // Create invitation (expires in 30 days)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const { data: invitation, error: inviteError } = await supabase
    .from("invitation_codes")
    .insert({
      company_id: ctx.companyId,
      email: data.email.toLowerCase(),
      invitation_code: invitationCode,
      created_by: ctx.userId!,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select("id, invitation_code, email, expires_at")
    .single()

  if (inviteError) {
    return { error: inviteError.message || "Failed to create invitation", data: null }
  }

  // Send invitation email: use Resend from company integration (Settings > Integration) or from env (RESEND_API_KEY)
  try {
    async function getResendClientAndFromEmail(companyId: string) {
      // 1. Company-specific key (from Settings > Integration)
      const { data: integrations } = await supabase
        .from("company_integrations")
        .select("resend_api_key, resend_from_email")
        .eq("company_id", companyId)
        .maybeSingle()

      const companyKey = integrations?.resend_api_key?.trim()
      const apiKey = companyKey || process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY
      if (!apiKey) return { resend: null, fromEmail: null }

      try {
        const { Resend } = await import("resend")
        const resend = new Resend(apiKey)
        const fromEmail =
          integrations?.resend_from_email?.trim() ||
          process.env.RESEND_FROM_EMAIL ||
          "onboarding@resend.dev"
        return { resend, fromEmail }
      } catch {
        return { resend: null, fromEmail: null }
      }
    }

    // Helper function to escape HTML
    function escapeHtml(text: string | null | undefined): string {
      if (!text) return ""
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    }

    const { resend, fromEmail: resolvedFromEmail } = await getResendClientAndFromEmail(ctx.companyId)

    if (!resend) {
      // If email service is not configured, still create the invitation
      // User can manually share the invitation link
      Sentry.captureMessage("[INVITE USER] Email service not configured, invitation created but email not sent", "warning")
      return {
        data: {
          invitation,
          emailSent: false,
          invitationLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?invitation=${invitationCode}`,
        },
        error: null,
      }
    }

    // Get company name
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name")
      .eq("id", ctx.companyId)
      .maybeSingle()

    if (companyError) {
      return { error: companyError.message, data: null }
    }

    const companyName = company?.name || "Your Company"
    const inviterName = inviterProfile?.full_name || "A team member"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const invitationLink = `${appUrl}/register?invitation=${invitationCode}`

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 14px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .info-box { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #4F46E5; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <p>Dear ${data.email},</p>
            
            <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(companyName)}</strong> on TruckMates Logistics Platform.</p>
            
            <div class="info-box">
              <p style="margin: 0;"><strong>Your Role:</strong> ${data.role.charAt(0).toUpperCase() + data.role.slice(1).replace(/_/g, " ")}</p>
              <p style="margin: 10px 0 0 0;"><strong>Invitation Expires:</strong> ${new Date(expiresAt).toLocaleDateString()}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${invitationLink}" class="button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
              Or copy and paste this link into your browser:<br>
              <a href="${invitationLink}" style="color: #4F46E5; word-break: break-all;">${invitationLink}</a>
            </p>
            
            <p style="margin-top: 30px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from TruckMates Logistics Platform.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const emailResult = await resend.emails.send({
      from: resolvedFromEmail ?? "onboarding@resend.dev",
      to: data.email,
      subject: `You're Invited to Join ${companyName} on TruckMates`,
      html: emailHtml,
    })

    if (emailResult.error) {
      Sentry.captureException(emailResult.error)
      // Still return success since invitation was created
      return {
        data: {
          invitation,
          emailSent: false,
          invitationLink,
          emailError: emailResult.error.message,
        },
        error: null,
      }
    }

    revalidatePath("/dashboard/settings/users")
    return {
      data: {
        invitation,
        emailSent: true,
        invitationLink,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    // Still return success since invitation was created
    return {
      data: {
        invitation,
        emailSent: false,
        invitationLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?invitation=${invitationCode}`,
        emailError: errorMessage(error, "Failed to send email"),
      },
      error: null,
    }
  }
}

/**
 * Get pending invitations for the company
 */
export async function getPendingInvitations() {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can view invitations", data: null }
  }

  const { data: invitations, error } = await supabase
    .from("invitation_codes")
    .select("id, email, invitation_code, status, created_at, expires_at, accepted_at")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: invitations || [], error: null }
}

/**
 * Cancel/delete an invitation
 */
export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", success: false }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can cancel invitations", success: false }
  }

  // Delete invitation (only if pending and belongs to company)
  const { error } = await supabase
    .from("invitation_codes")
    .delete()
    .eq("id", invitationId)
    .eq("company_id", ctx.companyId)
    .eq("status", "pending")

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath("/dashboard/settings/users")
  return { success: true, error: null }
}








