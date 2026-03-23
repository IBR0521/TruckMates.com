"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Initialize Resend (checks both env var and database)
// Initialize lazily to avoid errors if API key is not set or package not available
// FIXED: Decouple from auth context - check company integration using target user's company_id
async function getResendClient(companyId?: string) {
  // Always use platform API key from environment variables
  const apiKey = process.env.RESEND_API_KEY
  
  if (!apiKey) {
    console.error("[RESEND] Platform API key not configured")
    return null
  }

  // If companyId is provided, check if integration is enabled for that company
  if (companyId) {
    try {
      const supabase = await createClient()
      const { data: integrations } = await supabase
        .from("company_integrations")
        .select("resend_enabled")
        .eq("company_id", companyId)
        .single()

      if (!integrations?.resend_enabled) {
        console.log("[RESEND] Integration not enabled for company")
        return null
      }
    } catch (error) {
      console.error("[RESEND] Error checking integration:", error)
      return null
    }
  }
  
  try {
    // Dynamic import to avoid build errors if package is not installed
    const { Resend } = await import("resend")
    return new Resend(apiKey)
  } catch (error) {
    console.error("[RESEND] Failed to initialize Resend client:", error)
    return null
  }
}

export async function getNotificationPreferences() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.userId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", ctx.userId)
      .single()

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      return { error: error.message, data: null }
    }

    // If no preferences exist, return defaults
    if (!data) {
      return {
        data: {
          email_alerts: true,
          sms_alerts: true,
          weekly_reports: false,
          route_updates: true,
          load_updates: true,
          maintenance_alerts: true,
          payment_reminders: true,
        },
        error: null,
      }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error("[getNotificationPreferences] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}

export async function updateNotificationPreferences(preferences: {
  email_alerts?: boolean
  sms_alerts?: boolean
  weekly_reports?: boolean
  route_updates?: boolean
  load_updates?: boolean
  maintenance_alerts?: boolean
  payment_reminders?: boolean
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", success: false }
  }

  // FIXED: Use upsert to eliminate race condition
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: ctx.userId,
      ...preferences,
    }, {
      onConflict: "user_id"
    })

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath("/dashboard/settings")
  return { success: true, error: null }
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text: string | null | undefined): string {
  if (!text) return ""
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// Function to send notifications (to be called when events happen)
export async function sendNotification(
  userId: string,
  type: "route_update" | "load_update" | "maintenance_alert" | "payment_reminder" | "reminder_due" | "dfm_matches_found" | "marketplace_load_accepted" | "marketplace_new_matching_load",
  data: any
) {
  const supabase = await createClient()

  // Get user's notification preferences
  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!preferences) {
    return { sent: false, reason: "No preferences found" }
  }

  // Check if user wants this type of notification
  let shouldNotifyEmail = false
  let shouldNotifySMS = false
  switch (type) {
    case "route_update":
      shouldNotifyEmail = preferences.route_updates && preferences.email_alerts
      shouldNotifySMS = preferences.route_updates && preferences.sms_alerts
      break
    case "load_update":
      shouldNotifyEmail = preferences.load_updates && preferences.email_alerts
      shouldNotifySMS = preferences.load_updates && preferences.sms_alerts
      break
    case "maintenance_alert":
      shouldNotifyEmail = preferences.maintenance_alerts && preferences.email_alerts
      shouldNotifySMS = preferences.maintenance_alerts && preferences.sms_alerts
      break
    case "payment_reminder":
      shouldNotifyEmail = preferences.payment_reminders && preferences.email_alerts
      shouldNotifySMS = preferences.payment_reminders && preferences.sms_alerts
      break
    case "reminder_due":
      // Use payment_reminders preference for reminder notifications
      shouldNotifyEmail = preferences.payment_reminders && preferences.email_alerts
      shouldNotifySMS = preferences.payment_reminders && preferences.sms_alerts
      break
    case "dfm_matches_found":
      // DFM matches - default to enabled if load_updates is enabled
      shouldNotifyEmail = preferences.load_updates && preferences.email_alerts
      shouldNotifySMS = preferences.load_updates && preferences.sms_alerts
      break
    case "marketplace_load_accepted":
    case "marketplace_new_matching_load":
      // Marketplace events - default to enabled if load_updates is enabled
      shouldNotifyEmail = preferences.load_updates && preferences.email_alerts
      shouldNotifySMS = preferences.load_updates && preferences.sms_alerts
      break
  }

  const results: { email?: any; sms?: any } = {}

  // Send email notification
  if (shouldNotifyEmail) {
    // Get user email and name
    const { data: userData } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", userId)
      .single()

    if (userData?.email) {
      // FIXED: Get user's company_id to check integration settings
      const { data: userCompany } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", userId)
        .single()
      
      // Get Resend client with company_id for proper integration check
      const resend = await getResendClient(userCompany?.company_id)
      
      // If Resend is not configured, log and return (don't throw error)
      if (resend) {
        // Generate email content based on type
        const emailContent = getEmailContent(type, data, userData.full_name || "User")

        try {
          // Send email using Resend
          // Use your verified domain or Resend's default domain
          const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
          
          const result = await resend.emails.send({
            from: fromEmail,
            to: userData.email,
            subject: emailContent.subject,
            html: emailContent.html,
          })

          if (result.error) {
            console.error("[NOTIFICATION ERROR]", result.error)
            results.email = { sent: false, reason: result.error.message || "Failed to send email" }
          } else {
            results.email = { sent: true, email: userData.email, messageId: result.data?.id }
          }
        } catch (error: any) {
          // Don't throw - just log and return failure
          console.error("[NOTIFICATION ERROR]", error)
          results.email = { sent: false, reason: error?.message || "Failed to send email" }
        }
      } else {
        results.email = { sent: false, reason: "Email service not configured" }
      }
    }
  }

  // Send SMS notification
  if (shouldNotifySMS) {
    try {
      const { sendSMSNotification } = await import("./sms")
      // Type assertion: sendSMSNotification may not support all notification types
      const smsResult = await sendSMSNotification(userId, type as "route_update" | "load_update" | "maintenance_alert" | "payment_reminder" | "dispatch_assigned", data)
      results.sms = smsResult
    } catch (error: any) {
      console.error("[SMS NOTIFICATION ERROR]", error)
      results.sms = { sent: false, reason: error?.message || "Failed to send SMS" }
    }
  }

  const emailSent = results.email?.sent || false
  const smsSent = results.sms?.sent || false

  // FIXED: Always insert notification record into database for in-app bell and notifications page
  // This ensures email/SMS and in-app UI are connected
  try {
    // Get user data for notification title/message
    const { data: userData } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single()

    // Generate notification title and message
    let notificationTitle = "Notification"
    let notificationMessage = ""
    
    switch (type) {
      case "route_update":
        notificationTitle = `Route Update: ${data.routeName || "Route"}`
        notificationMessage = data.status ? `Status changed to ${data.status}` : "Route has been updated"
        break
      case "load_update":
        notificationTitle = `Load Update: ${data.shipmentNumber || "Load"}`
        notificationMessage = data.status ? `Status changed to ${data.status}` : "Load has been updated"
        break
      case "maintenance_alert":
        notificationTitle = `Maintenance Alert: ${data.truckNumber || "Vehicle"}`
        notificationMessage = data.serviceType ? `Service required: ${data.serviceType}` : "Maintenance scheduled"
        break
      case "payment_reminder":
        notificationTitle = `Payment Reminder: ${data.driverName || "Driver"}`
        notificationMessage = data.amount ? `Amount: $${data.amount}` : "Payment reminder"
        break
      case "reminder_due":
        notificationTitle = data.title || "Reminder Due"
        notificationMessage = data.description || `Reminder: ${data.title || "Task"} is due ${data.due_date ? `on ${data.due_date}` : "soon"}`
        break
      case "dfm_matches_found":
        notificationTitle = "DFM Matches Found"
        notificationMessage = data.count ? `${data.count} matching loads found` : "New dispatch matching opportunities"
        break
      case "marketplace_load_accepted":
        notificationTitle = "Marketplace Load Accepted"
        notificationMessage = data.shipmentNumber ? `Load ${data.shipmentNumber} has been accepted` : "Your marketplace load has been accepted"
        break
      case "marketplace_new_matching_load":
        notificationTitle = "New Marketplace Load"
        notificationMessage = data.shipmentNumber ? `New matching load: ${data.shipmentNumber}` : "New matching load available"
        break
    }

    // Determine priority from data or default to normal
    const priority = data.priority || "normal"

    // Insert notification record
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type: type,
        title: notificationTitle,
        message: notificationMessage,
        priority: priority,
        read: false,
        metadata: {
          ...data,
          email_sent: emailSent,
          sms_sent: smsSent,
          email_message_id: results.email?.messageId,
          sms_message_id: results.sms?.messageId,
        },
      })

    if (notifError) {
      console.error("[NOTIFICATION] Failed to insert notification record:", notifError)
      // Don't fail the entire function if DB insert fails
    }
  } catch (error: any) {
    console.error("[NOTIFICATION] Error inserting notification record:", error)
    // Don't fail the entire function if DB insert fails
  }

  return {
    sent: emailSent || smsSent,
    email: results.email,
    sms: results.sms,
    reason: emailSent || smsSent ? null : "User has disabled this notification type or service not configured",
  }
}

// Helper function to generate email content
function getEmailContent(
  type: "route_update" | "load_update" | "maintenance_alert" | "payment_reminder" | "reminder_due" | "dfm_matches_found" | "marketplace_load_accepted" | "marketplace_new_matching_load",
  data: any,
  userName: string
) {
  const baseStyle = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
    </style>
  `

  switch (type) {
    case "route_update":
      return {
        subject: `Route Update: ${data.routeName || "Route"}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Route Update</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>Your route <strong>${escapeHtml(data.routeName || "Route")}</strong> has been updated.</p>
              ${data.status ? `<p><strong>New Status:</strong> ${escapeHtml(data.status)}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/routes" class="button">View Route</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "load_update":
      return {
        subject: `Load Update: ${data.shipmentNumber || "Load"}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Load Update</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>Your load <strong>${escapeHtml(data.shipmentNumber || "Load")}</strong> status has been updated.</p>
              ${data.status ? `<p><strong>New Status:</strong> ${escapeHtml(data.status)}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/loads" class="button">View Load</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "maintenance_alert":
      return {
        subject: `Maintenance Alert: ${data.truckNumber || "Vehicle"}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Maintenance Alert</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>Maintenance is scheduled for <strong>${escapeHtml(data.truckNumber || "your vehicle")}</strong>.</p>
              ${data.serviceType ? `<p><strong>Service Type:</strong> ${escapeHtml(data.serviceType)}</p>` : ""}
              ${data.scheduledDate ? `<p><strong>Scheduled Date:</strong> ${escapeHtml(new Date(data.scheduledDate).toLocaleDateString())}</p>` : ""}
              ${data.priority === "high" ? `<p style="color: #dc2626;"><strong>Priority: High</strong></p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/maintenance" class="button">View Maintenance</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "reminder_due":
      return {
        subject: `Reminder: ${data.title || "Task Due"}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Reminder Due</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>You have a reminder: <strong>${escapeHtml(data.title || "Task")}</strong></p>
              ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ""}
              ${data.due_date ? `<p><strong>Due Date:</strong> ${escapeHtml(data.due_date)}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/reminders" class="button">View Reminders</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "payment_reminder":
      return {
        subject: `Payment Reminder: ${data.driverName || "Driver"}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>A payment reminder for <strong>${escapeHtml(data.driverName || "driver")}</strong>.</p>
              ${data.amount ? `<p><strong>Amount:</strong> $${escapeHtml(parseFloat(data.amount).toFixed(2))}</p>` : ""}
              ${data.period ? `<p><strong>Period:</strong> ${escapeHtml(data.period)}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/accounting/settlements" class="button">View Settlement</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "dfm_matches_found":
      return {
        subject: "DFM Matches Found",
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>DFM Matches Found</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>New dispatch matching opportunities have been found.</p>
              ${data.count ? `<p><strong>Matches Found:</strong> ${escapeHtml(String(data.count))}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/dispatch" class="button">View Matches</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "marketplace_load_accepted":
      return {
        subject: "Load Accepted",
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Load Accepted</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>Your load has been accepted.</p>
              ${data.shipmentNumber ? `<p><strong>Load:</strong> ${escapeHtml(data.shipmentNumber)}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/loads" class="button">View Loads</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    case "marketplace_new_matching_load":
      return {
        subject: "New Load Opportunity",
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>New Load Opportunity</h1>
            </div>
            <div class="content">
              <p>Hello ${escapeHtml(userName)},</p>
              <p>A new load opportunity is available.</p>
              ${data.shipmentNumber ? `<p><strong>Load:</strong> ${escapeHtml(data.shipmentNumber)}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>` : ""}
              ${data.rate ? `<p><strong>Rate:</strong> $${escapeHtml(String(data.rate))}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/loads" class="button">View Loads</a>
            </div>
            <div class="footer">
              <p>This is an automated notification from TruckMates.</p>
            </div>
          </div>
        `,
      }

    default:
      return {
        subject: "Notification from TruckMates",
        html: `<p>Hello ${escapeHtml(userName)},</p><p>You have a new notification.</p>`,
      }
  }
}

// Function to check if email service is configured
export async function checkEmailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  
  return {
    configured: !!apiKey,
    fromEmail,
    message: apiKey 
      ? "Email service is configured and ready" 
      : "Email service not configured. Add RESEND_API_KEY to environment variables.",
  }
}

// Function to send a test email
export async function sendTestEmail() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { sent: false, error: ctx.error || "Not authenticated" }
  }

  // Get user email and name
  const { data: userData } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", ctx.userId)
    .single()

  if (!userData?.email) {
    return { sent: false, error: "User email not found" }
  }

  // Get Resend client with company_id (from cached context)
  const resend = await getResendClient(ctx.companyId ?? undefined)
  
  if (!resend) {
    return { 
      sent: false, 
      error: "Email service not configured. Please add RESEND_API_KEY to your environment variables." 
    }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"
  
  const testEmailHtml = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
      .success-badge { display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 20px; }
    </style>
    <div class="container">
      <div class="header">
        <h1>Test Email from TruckMates</h1>
      </div>
      <div class="content">
        <div class="success-badge">✓ Email Service Working</div>
        <p>Hello ${userData.full_name || "User"},</p>
        <p>This is a test email to confirm that your email notification system is working correctly.</p>
        <p>If you received this email, it means:</p>
        <ul>
          <li>✅ Resend API is properly configured</li>
          <li>✅ Email service is operational</li>
          <li>✅ You will receive notifications for enabled events</li>
        </ul>
        <p>You can manage your notification preferences in your <a href="${appUrl}/dashboard/settings">Settings</a> page.</p>
        <a href="${appUrl}/dashboard/settings" class="button">Go to Settings</a>
      </div>
      <div class="footer">
        <p>This is a test email from TruckMates notification system.</p>
        <p>If you did not request this test, you can safely ignore this email.</p>
      </div>
    </div>
  `

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: userData.email,
      subject: "Test Email - TruckMates Notifications",
      html: testEmailHtml,
    })

    if (result.error) {
      console.error("[TEST EMAIL ERROR]", result.error)
      return { sent: false, error: result.error.message || "Failed to send test email" }
    }

    return { 
      sent: true, 
      email: userData.email, 
      messageId: result.data?.id,
      message: "Test email sent successfully! Check your inbox." 
    }
  } catch (error: any) {
    console.error("[TEST EMAIL ERROR]", error)
    return { sent: false, error: error?.message || "Failed to send test email" }
  }
}

/**
 * Delete notification
 * LOW FIX 17: Implement deleteNotification server action
 */
export async function deleteNotification(notificationId: string, notificationType: "notification" | "alert") {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  if (!ctx.companyId) {
    return { error: "No company found", data: null }
  }

  try {
    if (notificationType === "notification") {
      // Delete from notifications table (user can only delete their own)
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", ctx.userId)

      if (error) {
        return { error: error.message, data: null }
      }
    } else if (notificationType === "alert") {
      // Delete from alerts table (with company_id check)
      const { error } = await supabase
        .from("alerts")
        .delete()
        .eq("id", notificationId)
        .eq("company_id", ctx.companyId)

      if (error) {
        return { error: error.message, data: null }
      }
    } else {
      return { error: "Invalid notification type", data: null }
    }

    revalidatePath("/dashboard/notifications")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to delete notification", data: null }
  }
}

/**
 * Get unread notification count (efficient COUNT query)
 * MEDIUM FIX 13: Use COUNT(*) instead of fetching all records
 */
export async function getUnreadNotificationCount() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  if (!ctx.companyId) {
    return { error: "No company found", data: null }
  }

  // Use efficient COUNT queries instead of fetching all records
  const [notificationsResult, alertsResult] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("read", false),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId).in("status", ["pending", "active"]),
  ])

  const notificationsCount = notificationsResult.count || 0
  const alertsCount = alertsResult.count || 0

  return {
    data: {
      total: notificationsCount + alertsCount,
      notifications: notificationsCount,
      alerts: alertsCount,
    },
    error: null
  }
}

/**
 * Cleanup job:
 * Delete read in-app notifications older than `olderThanDays` to prevent unbounded table growth.
 *
 * Uses the Supabase service-role client (bypasses RLS) and should only be called from cron/jobs.
 */
export async function cleanupReadNotifications(olderThanDays: number = 90) {
  const admin = createAdminClient()

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { error } = await admin
      .from("notifications")
      .delete()
      .eq("read", true)
      .lt("created_at", cutoff)

    return {
      data: { success: !error, cutoffISO: cutoff },
      error: error ? error.message : null,
    }
  } catch (err: any) {
    return {
      data: null,
      error: err?.message || "Failed to cleanup notifications",
    }
  }
}

