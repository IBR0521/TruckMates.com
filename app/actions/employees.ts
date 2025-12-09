"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"

// Get all employees for a company (managers only)
export async function getEmployees() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (!userData) {
    return { error: "User not found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can view employees", data: null }
  }

  if (!userData.company_id) {
    return { error: "No company found", data: null }
  }

  // Get all users in the company (excluding the manager themselves)
  const { data: employees, error } = await supabase
    .from("users")
    .select("*")
    .eq("company_id", userData.company_id)
    .neq("id", user.id) // Exclude the manager
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: employees, error: null }
}

// Create invitation for employee
export async function createEmployeeInvitation(email: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id, email")
    .eq("id", user.id)
    .single()

  if (!userData) {
    return { error: "User not found", data: null }
  }

  if (userData.role !== "manager") {
    return { error: "Only managers can create invitations", data: null }
  }

  if (!userData.company_id) {
    return { error: "No company found", data: null }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: "Invalid email format", data: null }
  }

  // Check if email already exists in the company
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, role, email")
    .eq("email", email.toLowerCase().trim())
    .eq("company_id", userData.company_id)
    .maybeSingle()

  if (existingUser) {
    if (existingUser.role === "manager") {
      return { error: "Cannot add another manager", data: null }
    }
    return { error: "User is already in your company", data: null }
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvitation } = await supabase
    .from("invitation_codes")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .eq("company_id", userData.company_id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (existingInvitation) {
    return { error: "An invitation already exists for this email", data: null }
  }

  // Generate invitation code
  const { data: codeData, error: codeError } = await supabase.rpc("generate_invitation_code")

  if (codeError) {
    // Fallback: generate code manually
    const invitationCode = `EMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    
    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitation_codes")
      .insert({
        company_id: userData.company_id,
        email: email.toLowerCase().trim(),
        invitation_code: invitationCode,
        created_by: user.id,
        status: "pending",
      })
      .select()
      .single()

    if (inviteError) {
      return { error: inviteError.message, data: null }
    }

    // Send email with invitation code
    await sendInvitationEmail(email, invitationCode, userData.email || "")

    revalidatePath("/dashboard/employees")
    revalidatePath("/account-setup/manager")
    return { data: invitation, error: null }
  }

  // Create invitation with generated code
  const { data: invitation, error: inviteError } = await supabase
    .from("invitation_codes")
    .insert({
      company_id: userData.company_id,
      email: email.toLowerCase().trim(),
      invitation_code: codeData,
      created_by: user.id,
      status: "pending",
    })
    .select()
    .single()

  if (inviteError) {
    return { error: inviteError.message, data: null }
  }

  // Send email with invitation code
  await sendInvitationEmail(email, codeData, userData.email || "")

  revalidatePath("/dashboard/employees")
  revalidatePath("/account-setup/manager")
  return { data: invitation, error: null }
}

// Verify and accept invitation code
export async function verifyAndAcceptInvitation(invitationCode: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Use the database function to accept invitation
  const { data: companyId, error } = await supabase.rpc("accept_invitation", {
    p_invitation_code: invitationCode.trim().toUpperCase(),
    p_user_id: user.id,
  })

  if (error) {
    return { error: error.message || "Invalid or expired invitation code", data: null }
  }

  revalidatePath("/dashboard")
  revalidatePath("/account-setup/user")
  return { data: { company_id: companyId }, error: null }
}

// Update employee (status, position, etc.)
export async function updateEmployee(
  employeeId: string,
  updates: {
    full_name?: string
    email?: string
    phone?: string
    position?: string
    employee_status?: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "manager") {
    return { error: "Only managers can update employees", data: null }
  }

  // Verify employee belongs to manager's company and is not a manager
  const { data: employee } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", employeeId)
    .single()

  if (!employee) {
    return { error: "Employee not found", data: null }
  }

  if (employee.company_id !== userData.company_id) {
    return { error: "Employee does not belong to your company", data: null }
  }

  if (employee.role === "manager") {
    return { error: "Cannot update manager accounts", data: null }
  }

  // Update employee
  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", employeeId)

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}

// Remove employee from company
export async function removeEmployee(employeeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "manager") {
    return { error: "Only managers can remove employees", data: null }
  }

  // Verify employee belongs to manager's company and is not a manager
  const { data: employee } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", employeeId)
    .single()

  if (!employee) {
    return { error: "Employee not found", data: null }
  }

  if (employee.company_id !== userData.company_id) {
    return { error: "Employee does not belong to your company", data: null }
  }

  if (employee.role === "manager") {
    return { error: "Cannot remove manager accounts", data: null }
  }

  if (employee.id === user.id) {
    return { error: "Cannot remove yourself", data: null }
  }

  // Remove employee by setting company_id to null
  const { error: removeError } = await supabase
    .from("users")
    .update({ company_id: null })
    .eq("id", employeeId)

  if (removeError) {
    return { error: removeError.message, data: null }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}

// Get pending invitations for a company
export async function getPendingInvitations() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager - try using the helper function first, then fallback
  let userRole: string | null = null
  let companyId: string | null = null

  // Try using the RPC function (bypasses RLS)
  const { data: roleData, error: roleError } = await supabase.rpc("get_user_role_and_company")

  if (!roleError && roleData && roleData.length > 0) {
    userRole = roleData[0].role
    companyId = roleData[0].company_id
  } else {
    // Fallback: try direct query (might fail due to RLS, but worth trying)
    const { data: userData } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (userData) {
      userRole = userData.role
      companyId = userData.company_id
    }
  }

  if (!userRole || userRole !== "manager") {
    return { error: "Only managers can view invitations", data: null }
  }

  if (!companyId) {
    return { error: "No company found", data: null }
  }

  // Get pending invitations
  const { data: invitations, error } = await supabase
    .from("invitation_codes")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: invitations, error: null }
}

// Cancel invitation
export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check if user is a manager
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "manager") {
    return { error: "Only managers can cancel invitations", data: null }
  }

  // Verify invitation belongs to manager's company
  const { data: invitation } = await supabase
    .from("invitation_codes")
    .select("company_id, status")
    .eq("id", invitationId)
    .single()

  if (!invitation) {
    return { error: "Invitation not found", data: null }
  }

  if (invitation.company_id !== userData.company_id) {
    return { error: "Invitation does not belong to your company", data: null }
  }

  if (invitation.status !== "pending") {
    return { error: "Can only cancel pending invitations", data: null }
  }

  // Cancel invitation
  const { error: cancelError } = await supabase
    .from("invitation_codes")
    .update({ status: "cancelled" })
    .eq("id", invitationId)

  if (cancelError) {
    return { error: cancelError.message, data: null }
  }

  revalidatePath("/dashboard/employees")
  return { data: { success: true }, error: null }
}

// Helper function to send invitation email
async function sendInvitationEmail(
  employeeEmail: string,
  invitationCode: string,
  managerEmail: string
) {
  try {
    const { Resend } = await import("resend")
    
    // Get Resend client
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log(`[INVITATION] Resend not configured. Invitation code: ${invitationCode}`)
      return
    }
    
    const resend = new Resend(apiKey)

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://truckmateslogistic.com"

  const emailHtml = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .code-box { background: white; border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
      .code { font-size: 24px; font-weight: bold; color: #4F46E5; letter-spacing: 2px; }
      .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
    </style>
    <div class="container">
      <div class="header">
        <h1>You've Been Invited to Join TruckMates!</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>You have been invited to join a company on TruckMates logistics management platform.</p>
        <p>To accept this invitation and join the company, please use the following invitation code:</p>
        <div class="code-box">
          <div class="code">${invitationCode}</div>
        </div>
        <p><strong>How to use this code:</strong></p>
        <ol>
          <li>If you don't have an account, <a href="${appUrl}/register/user">create one here</a></li>
          <li>After registration, go to account setup</li>
          <li>Select "Work Under Manager Account"</li>
          <li>Enter the invitation code above</li>
        </ol>
        <p>This invitation code will expire in 30 days.</p>
        <a href="${appUrl}/register/user" class="button">Create Account & Join</a>
      </div>
      <div class="footer">
        <p>This is an automated invitation from TruckMates.</p>
        <p>If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
    </div>
  `

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: employeeEmail,
      subject: `Invitation to Join TruckMates - Code: ${invitationCode}`,
      html: emailHtml,
    })

    if (result.error) {
      console.error("[INVITATION EMAIL ERROR]", result.error)
    }
  } catch (error: any) {
    console.error("[INVITATION EMAIL ERROR]", error)
  }
  } catch (importError) {
    // Resend package not installed or import failed
    console.log(`[INVITATION] Resend package not available. Invitation code: ${invitationCode}`)
  }
}

