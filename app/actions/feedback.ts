"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { sanitizeString } from "@/lib/validation"

// Initialize Resend for email notifications (uses platform API key)
async function getResendClient() {
  // Always use platform API key from environment variables
  const apiKey = process.env.RESEND_API_KEY
  
  if (!apiKey) {
    console.error("[RESEND] Platform API key not configured")
    return null
  }

  // Check if integration is enabled for this company
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { getCachedUserCompany } = await import("@/lib/query-optimizer")
      const result = await getCachedUserCompany(user.id)
      
      if (result.company_id) {
        const { data: integrations } = await supabase
          .from("company_integrations")
          .select("resend_enabled")
          .eq("company_id", result.company_id)
          .single()

        if (!integrations?.resend_enabled) {
          console.log("[RESEND] Integration not enabled for company")
          return null
        }
      }
    }
  } catch (error) {
    console.error("[RESEND] Error checking integration:", error)
    return null
  }
  
  try {
    const { Resend } = await import("resend")
    return new Resend(apiKey)
  } catch (error) {
    console.error("[RESEND] Failed to initialize Resend client:", error)
    return null
  }
}

// Send feedback notification email to admin
async function sendFeedbackEmail(feedbackData: {
  type: string
  title: string
  message: string
  priority: string
  userName: string
  userEmail: string
  companyName?: string
}) {
  const resend = await getResendClient()
  if (!resend) {
    console.log("[FEEDBACK EMAIL] Resend not configured, skipping email")
    return { sent: false, reason: "Email service not configured" }
  }

  // Get admin email from environment variable or use default
  const adminEmail = process.env.ADMIN_EMAIL || process.env.FEEDBACK_EMAIL || "ibr20117o@gmail.com"

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const typeLabels: Record<string, string> = {
    feedback: "General Feedback",
    suggestion: "Suggestion",
    bug_report: "Bug Report",
    feature_request: "Feature Request",
  }

  const priorityColors: Record<string, string> = {
    urgent: "#dc2626",
    high: "#ea580c",
    normal: "#2563eb",
    low: "#6b7280",
  }

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
        .priority-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white; }
        .message-box { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #4F46E5; margin: 20px 0; }
        .info-row { margin: 10px 0; }
        .info-label { font-weight: bold; color: #6b7280; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Feedback Received</h1>
        </div>
        <div class="content">
          <div class="badge" style="background: ${priorityColors[feedbackData.priority] || '#2563eb'}; color: white;">
            ${typeLabels[feedbackData.type] || feedbackData.type}
          </div>
          
          <div class="info-row">
            <span class="info-label">From:</span> ${feedbackData.userName} (${feedbackData.userEmail})
          </div>
          ${feedbackData.companyName ? `<div class="info-row"><span class="info-label">Company:</span> ${feedbackData.companyName}</div>` : ''}
          <div class="info-row">
            <span class="info-label">Priority:</span> 
            <span class="priority-badge" style="background: ${priorityColors[feedbackData.priority] || '#2563eb'}">
              ${feedbackData.priority.charAt(0).toUpperCase() + feedbackData.priority.slice(1)}
            </span>
          </div>
          
          <div class="message-box">
            <h3 style="margin-top: 0; color: #1f2937;">${feedbackData.title}</h3>
            <p style="white-space: pre-wrap; margin-bottom: 0;">${feedbackData.message}</p>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${appUrl}/dashboard" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
              View in Dashboard
            </a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification from TruckMates feedback system.</p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `[${typeLabels[feedbackData.type] || 'Feedback'}] ${feedbackData.title}`,
      html: emailHtml,
    })

    if (result.error) {
      console.error("[FEEDBACK EMAIL ERROR]", result.error)
      return { sent: false, reason: result.error.message || "Failed to send email" }
    }

    return { sent: true, email: adminEmail, messageId: result.data?.id }
  } catch (error: any) {
    console.error("[FEEDBACK EMAIL ERROR]", error)
    return { sent: false, reason: error?.message || "Failed to send email" }
  }
}

// Get all feedback for the current user
export async function getFeedback(filters?: {
  type?: string
  status?: string
  limit?: number
  offset?: number
}) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  // Build query - users can only see their own feedback
  let query = supabase
    .from("feedback")
    .select("id, type, category, title, message, priority, status, created_at, updated_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Apply filters
  if (filters?.type) {
    query = query.eq("type", filters.type)
  }

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  // Apply pagination (default limit 25, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data: feedback, error, count } = await query

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: feedback || [], error: null, count: count || 0 }
  } catch (error: any) {
    console.error("[FEEDBACK] Error in getFeedback:", error)
    return { error: error?.message || "Failed to fetch feedback", data: null, count: 0 }
  }
}

// Get a single feedback item
export async function getFeedbackItem(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: feedbackItem, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user can only access their own feedback
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: feedbackItem, error: null }
}

// Create new feedback
export async function createFeedback(formData: {
  type: string
  category?: string
  title: string
  message: string
  priority?: string
  userEmail?: string
  userName?: string
  userSurname?: string
}) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  // Get user's company_id
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  // Validate and sanitize input
  const title = sanitizeString(formData.title.trim())
  const message = sanitizeString(formData.message.trim())

  if (!title || title.length < 3) {
    return { error: "Title must be at least 3 characters long", data: null }
  }

  if (!message || message.length < 10) {
    return { error: "Message must be at least 10 characters long", data: null }
  }

  // Validate type
  const validTypes = ["feedback", "suggestion", "bug_report", "feature_request"]
  if (!validTypes.includes(formData.type)) {
    return { error: "Invalid feedback type", data: null }
  }

  // Validate priority if provided
  if (formData.priority) {
    const validPriorities = ["low", "normal", "high", "urgent"]
    if (!validPriorities.includes(formData.priority)) {
      return { error: "Invalid priority level", data: null }
    }
  }

  // Get user info for email notification (use provided info or fallback to database)
  const { data: userData } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", user.id)
    .single()

  // Use provided user info or fallback to database user info
  const feedbackUserName = formData.userName 
    ? `${formData.userName}${formData.userSurname ? ` ${formData.userSurname}` : ''}`
    : userData?.full_name || "User"
  const feedbackUserEmail = formData.userEmail || userData?.email || "Unknown"

  // Get company name for email
  const { data: companyData } = await supabase
    .from("companies")
    .select("name")
    .eq("id", company_id)
    .single()

  // Insert feedback
  const { data: feedback, error } = await supabase
    .from("feedback")
    .insert({
      user_id: user.id,
      company_id: company_id,
      type: formData.type,
      category: formData.category ? sanitizeString(formData.category) : null,
      title: title,
      message: message,
      priority: formData.priority || "normal",
      status: "open",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Send email notification (non-blocking)
  sendFeedbackEmail({
    type: formData.type,
    title: title,
    message: message,
    priority: formData.priority || "normal",
    userName: feedbackUserName,
    userEmail: feedbackUserEmail,
    companyName: companyData?.name,
  }).catch((emailError) => {
    // Don't fail the feedback submission if email fails
    console.error("[FEEDBACK] Failed to send email notification:", emailError)
  })

  revalidatePath("/dashboard/feedback")
  return { data: feedback, error: null }
  } catch (error: any) {
    console.error("[FEEDBACK] Error in createFeedback:", error)
    return { error: error?.message || "Failed to create feedback", data: null }
  }
}

// Update feedback (only if status is 'open')
export async function updateFeedback(id: string, formData: {
  title?: string
  message?: string
  category?: string
  priority?: string
}) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  // First, check if feedback exists and belongs to user, and status is 'open'
  const { data: existingFeedback, error: fetchError } = await supabase
    .from("feedback")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !existingFeedback) {
    return { error: "Feedback not found or access denied", data: null }
  }

  if (existingFeedback.status !== "open") {
    return { error: "Cannot update feedback that has been reviewed", data: null }
  }

  // Build update object
  const updateData: any = {}

  if (formData.title !== undefined) {
    const title = sanitizeString(formData.title.trim())
    if (title.length < 3) {
      return { error: "Title must be at least 3 characters long", data: null }
    }
    updateData.title = title
  }

  if (formData.message !== undefined) {
    const message = sanitizeString(formData.message.trim())
    if (message.length < 10) {
      return { error: "Message must be at least 10 characters long", data: null }
    }
    updateData.message = message
  }

  if (formData.category !== undefined) {
    updateData.category = formData.category ? sanitizeString(formData.category) : null
  }

  if (formData.priority !== undefined) {
    const validPriorities = ["low", "normal", "high", "urgent"]
    if (!validPriorities.includes(formData.priority)) {
      return { error: "Invalid priority level", data: null }
    }
    updateData.priority = formData.priority
  }

  // Update feedback
  const { data: feedback, error } = await supabase
    .from("feedback")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/feedback")
  return { data: feedback, error: null }
}

