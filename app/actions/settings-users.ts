"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import * as Sentry from "@sentry/nextjs"

const MANAGER_ROLES: readonly EmployeeRole[] = ["super_admin", "operations_manager"]

async function generateSixDigitInvitationCode(adminSupabase: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>) {
  // Use numeric 6-digit codes as requested (100000-999999).
  // Retry a few times to avoid rare uniqueness collisions.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const { data: existing, error } = await adminSupabase
      .from("invitation_codes")
      .select("id")
      .eq("invitation_code", code)
      .maybeSingle()

    if (!error && !existing) {
      return code
    }
  }

  // Extremely unlikely fallback
  return String(Math.floor(100000 + Math.random() * 900000))
}

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

    await reconcileInvitationsWithExistingUsers(ctx.companyId)

    // Use service role so the full company roster is returned. RLS on `users` can hide rows
    // for managers (policy / helper edge cases) even when a user row exists for the company.
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const admin = createAdminClient()
    const { data: users, error } = await admin
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
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", success: false }
    }

    const role = await getUserRole()
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { error: "Only managers can update user roles", success: false }
    }

    const normalizedNewRole = String(newRole).trim().toLowerCase()

    // Validate newRole against exact 6 roles
    const VALID_ROLES = ["super_admin", "operations_manager", "dispatcher", "safety_compliance", "financial_controller", "driver"]
    if (!VALID_ROLES.includes(normalizedNewRole)) {
      return { error: `Invalid role: ${newRole}. Must be one of: ${VALID_ROLES.join(", ")}`, success: false }
    }

    // Prevent self-promotion to super_admin
    if (userId === ctx.userId && normalizedNewRole === "super_admin") {
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
    const targetLevel = roleHierarchy[normalizedNewRole] || 0
    if (targetLevel > callerLevel) {
      return { error: `You cannot assign a role higher than your own (${role})`, success: false }
    }

    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminSupabase = createAdminClient()

    // Session client is subject to RLS; updates often affect 0 rows with no error. Use admin
    // after authorization checks, scoped by id + company_id.
    const { data: targetRow, error: targetErr } = await adminSupabase
      .from("users")
      .select("id, company_id, email, full_name, phone, role")
      .eq("id", userId)
      .maybeSingle()

    if (targetErr) {
      return { error: targetErr.message, success: false }
    }
    if (!targetRow || targetRow.company_id !== ctx.companyId) {
      return { error: "User not found in your company", success: false }
    }

    const { data: updated, error: updateErr } = await adminSupabase
      .from("users")
      .update({ role: normalizedNewRole })
      .eq("id", userId)
      .eq("company_id", ctx.companyId)
      .select("id")
      .maybeSingle()

    if (updateErr) {
      return { error: updateErr.message, success: false }
    }
    if (!updated) {
      return { error: "Could not update role. No matching user row was updated.", success: false }
    }

    // Keep auth metadata in sync; merge so we do not wipe other keys.
    try {
      const { data: authUserData, error: getUserErr } = await adminSupabase.auth.admin.getUserById(userId)
      if (getUserErr) {
        Sentry.captureException(getUserErr)
      } else {
        const existing = (authUserData.user?.user_metadata || {}) as Record<string, unknown>
        const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existing,
            employee_role: normalizedNewRole,
            role: normalizedNewRole,
          },
        })
        if (authError) {
          Sentry.captureException(authError)
        }
      }
    } catch (error) {
      Sentry.captureException(error)
    }

    revalidatePath("/dashboard/settings/users")

    // If the manager just set this user as a driver, upsert the corresponding
    // row in `public.drivers` so they show up automatically in the Drivers list.
    // Note: Drivers list is driven by `public.drivers`, not `public.users.role`.
    if (normalizedNewRole === "driver" && ctx.companyId) {
      try {
        const driverUserId = userId
        const companyId = ctx.companyId
        const emailLower = (targetRow?.email || "").toLowerCase().trim()
        const fullName = (targetRow?.full_name || targetRow?.email || "Driver").toString().trim()
        const phone = targetRow?.phone || null

        const { data: existingDrivers } = await adminSupabase
          .from("drivers")
          .select("id")
          .eq("user_id", driverUserId)
          .eq("company_id", companyId)
          .limit(1)

        if (existingDrivers && existingDrivers.length > 0) {
          await adminSupabase
            .from("drivers")
            .update({
              name: fullName,
              email: emailLower || null,
              phone,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", driverUserId)
            .eq("company_id", companyId)
        } else {
          await adminSupabase.from("drivers").insert({
            user_id: driverUserId,
            company_id: companyId,
            name: fullName,
            email: emailLower || null,
            phone,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e: unknown) {
        // Don't block the role update if driver row creation fails.
        Sentry.captureException(e)
      }
    }

    return { success: true, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { success: false, error: errorMessage(error, "An unexpected error occurred") }
  }
}

export async function removeUser(userId: string) {
  try {
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

    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminSupabase = createAdminClient()

    const { data: targetUser, error: targetUserError } = await adminSupabase
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

    const { data: deleted, error } = await adminSupabase
      .from("users")
      .delete()
      .eq("id", userId)
      .eq("company_id", ctx.companyId)
      .select("id")
      .maybeSingle()

    if (error) {
      return { error: error.message, success: false }
    }
    if (!deleted) {
      return { error: "Could not remove user. No matching row was deleted.", success: false }
    }

    try {
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId)

      if (deleteError) {
        Sentry.captureException(deleteError)
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

  // Generate unique 6-digit invitation code
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const adminSupabase = createAdminClient()
  const invitationCode = await generateSixDigitInvitationCode(adminSupabase)

  // Create invitation (expires in 30 days)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const { data: invitation, error: inviteError } = await adminSupabase
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
    async function getResendClientsAndFromEmail(companyId: string) {
      // 1. Company-specific key (from Settings > Integration)
      const { data: integrations } = await supabase
        .from("company_integrations")
        .select("resend_api_key, resend_from_email")
        .eq("company_id", companyId)
        .maybeSingle()

      const companyKey = integrations?.resend_api_key?.trim()
      const envKey = process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY
      // Prefer env key first so a stale company key can't block sends.
      const candidateKeys = [envKey, companyKey].filter((k): k is string => Boolean(k))
      if (candidateKeys.length === 0) return { resendClients: [], fromEmail: null }

      try {
        const { Resend } = await import("resend")
        const resendClients = candidateKeys.map((apiKey) => new Resend(apiKey))
        const fromEmail =
          process.env.RESEND_FROM_EMAIL?.trim() ||
          integrations?.resend_from_email?.trim() ||
          "notifications@truckmateslogistic.com"
        return { resendClients, fromEmail }
      } catch {
        return { resendClients: [], fromEmail: null }
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

    const { resendClients, fromEmail: resolvedFromEmail } = await getResendClientsAndFromEmail(ctx.companyId)

    if (resendClients.length === 0) {
      // If email service is not configured, still create the invitation
      // User can manually share the invitation link
      Sentry.captureMessage("[INVITE USER] Email service not configured, invitation created but email not sent", "warning")
      return {
        data: {
          invitation,
          emailSent: false,
          invitationLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register/employee?invitation=${invitationCode}&role=${encodeURIComponent(data.role)}`,
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
    const invitationLink = `${appUrl}/register/employee?invitation=${invitationCode}&role=${encodeURIComponent(data.role)}`

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
              <p style="margin: 10px 0 0 0;"><strong>Invitation Code:</strong> <code style="background:#eef2ff;padding:2px 6px;border-radius:4px;">${invitationCode}</code></p>
              <p style="margin: 10px 0 0 0;"><strong>Company ID:</strong> <code style="background:#eef2ff;padding:2px 6px;border-radius:4px;">${ctx.companyId}</code></p>
            </div>
            
            <div style="text-align: center;">
              <a href="${invitationLink}" class="button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
              Or copy and paste this link into your browser:<br>
              <a href="${invitationLink}" style="color: #4F46E5; word-break: break-all;">${invitationLink}</a>
            </p>

            <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:12px;margin-top:16px;">
              <p style="margin:0 0 8px 0;"><strong>If registration asks for Company ID or Invitation Code:</strong></p>
              <p style="margin:0 0 4px 0;">Invitation Code: <code style="background:#fff7ed;padding:2px 6px;border-radius:4px;">${invitationCode}</code></p>
              <p style="margin:0;">Company ID: <code style="background:#fff7ed;padding:2px 6px;border-radius:4px;">${ctx.companyId}</code></p>
            </div>
            
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

    let emailResult: Awaited<ReturnType<typeof resendClients[number]["emails"]["send"]>> | null = null
    const sendErrors: string[] = []
    const recipientEmail = data.email.toLowerCase()
    const safeFromEmail =
      resolvedFromEmail?.includes("onboarding@resend.dev") && !recipientEmail.endsWith("@resend.dev")
        ? "notifications@truckmateslogistic.com"
        : (resolvedFromEmail ?? "notifications@truckmateslogistic.com")

    for (const resendClient of resendClients) {
      try {
        emailResult = await resendClient.emails.send({
          from: safeFromEmail,
          to: data.email,
          subject: `You're Invited to Join ${companyName} on TruckMates`,
          html: emailHtml,
        })
        if (!emailResult.error) break
        sendErrors.push(emailResult.error.message)
      } catch (error: unknown) {
        sendErrors.push(errorMessage(error, "Failed to send invitation email"))
        continue
      }
    }

    if (!emailResult || emailResult.error) {
      Sentry.captureException(emailResult?.error ?? new Error("Unknown resend error"))
      // Still return success since invitation was created
      return {
        data: {
          invitation,
          emailSent: false,
          invitationLink,
          emailError: emailResult?.error?.message ?? sendErrors[sendErrors.length - 1] ?? "Failed to send invitation email",
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
        invitationLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register/employee?invitation=${invitationCode}&role=${encodeURIComponent(data.role)}`,
        emailError: errorMessage(error, "Failed to send email"),
      },
      error: null,
    }
  }
}

/**
 * Build email -> auth user map (paginated; service role only).
 */
async function loadAuthUsersByEmail(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
) {
  const byEmail = new Map<string, { id: string; user_metadata: Record<string, unknown> }>()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) {
      if (u.email) {
        byEmail.set(u.email.toLowerCase(), {
          id: u.id,
          user_metadata: (u.user_metadata || {}) as Record<string, unknown>,
        })
      }
    }
    if (data.users.length < 1000) break
    page += 1
  }
  return byEmail
}

/**
 * Mark invitations accepted when the person already registered:
 * - public.users row with same email + company (or company_id null — attach to invite company)
 * - or auth user exists but profile missing / incomplete — upsert public.users then accept invite
 */
async function reconcileInvitationsWithExistingUsers(companyId: string) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const admin = createAdminClient()

    const { data: pending, error: pendingError } = await admin
      .from("invitation_codes")
      .select("id, email")
      .eq("company_id", companyId)
      .eq("status", "pending")

    if (pendingError || !pending?.length) return

    let authByEmail: Map<string, { id: string; user_metadata: Record<string, unknown> }> | null = null
    const now = new Date().toISOString()

    for (const inv of pending) {
      const emailLower = String(inv.email).toLowerCase().trim()
      if (!emailLower) continue

      const { data: profile } = await admin
        .from("users")
        .select("id, email, company_id, full_name")
        .eq("email", emailLower)
        .maybeSingle()

      let acceptorId: string | null = null

      if (profile?.id) {
        const cid = profile.company_id as string | null
        if (cid === companyId) {
          acceptorId = profile.id
        } else if (cid == null) {
          const { error: attachErr } = await admin
            .from("users")
            .update({
              company_id: companyId,
              employee_status: "active",
            })
            .eq("id", profile.id)
          if (!attachErr) acceptorId = profile.id
        }
        // else: profile tied to another company — do not reassign automatically
      }

      if (!acceptorId) {
        if (profile?.company_id && profile.company_id !== companyId) {
          continue
        }

        if (!authByEmail) authByEmail = await loadAuthUsersByEmail(admin)
        const authUser = authByEmail.get(emailLower)
        if (authUser?.id) {
          const meta = authUser.user_metadata
          const rawRole =
            (meta.employee_role as string) || (meta.role as string) || "driver"
          const role = mapLegacyRole(String(rawRole).trim().toLowerCase())
          const fullName =
            (meta.full_name as string)?.trim() ||
            profile?.full_name ||
            emailLower.split("@")[0] ||
            "User"

          const { error: upsertErr } = await admin.from("users").upsert(
            {
              id: authUser.id,
              email: emailLower,
              full_name: fullName,
              role,
              company_id: companyId,
              employee_status: "active",
            },
            { onConflict: "id" },
          )

          if (!upsertErr) acceptorId = authUser.id

          // If the invited employee is a driver, ensure they also exist in `public.drivers`
          // so they show up automatically in the Drivers list.
          if (!upsertErr && role === "driver" && acceptorId) {
            try {
              const { data: existingDrivers } = await admin
                .from("drivers")
                .select("id")
                .eq("user_id", acceptorId)
                .eq("company_id", companyId)
                .limit(1)

              if (existingDrivers && existingDrivers.length > 0) {
                await admin
                  .from("drivers")
                  .update({
                    name: fullName,
                    email: emailLower,
                    phone: null,
                    status: "active",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("user_id", acceptorId)
                  .eq("company_id", companyId)
              } else {
                await admin.from("drivers").insert({
                  user_id: acceptorId,
                  company_id: companyId,
                  name: fullName,
                  email: emailLower,
                  phone: null,
                  status: "active",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
              }
            } catch (e: unknown) {
              // Don't block invitation reconciliation if driver row creation fails.
              Sentry.captureException(e)
            }
          }
        }
      }

      if (acceptorId) {
        await admin
          .from("invitation_codes")
          .update({
            status: "accepted",
            accepted_at: now,
            accepted_by: acceptorId,
          })
          .eq("id", inv.id)
          .eq("status", "pending")
      }
    }
  } catch (e) {
    Sentry.captureException(e)
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

  await reconcileInvitationsWithExistingUsers(ctx.companyId)

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

  // Delete invitation (only if pending and belongs to company).
  // Use admin client for the delete itself to avoid RLS false-negatives while
  // keeping all manager/company authorization checks above.
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const adminSupabase = createAdminClient()

  const { data: deletedRows, error } = await adminSupabase
    .from("invitation_codes")
    .delete()
    .eq("id", invitationId)
    .eq("company_id", ctx.companyId)
    .eq("status", "pending")
    .select("id")

  if (error) {
    return { error: error.message, success: false }
  }

  if (!deletedRows || deletedRows.length === 0) {
    return { error: "Invitation not found or already processed", success: false }
  }

  revalidatePath("/dashboard/settings/users")
  return { success: true, error: null }
}








