"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Initialize Resend (checks both env var and database)
// Initialize lazily to avoid errors if API key is not set or package not available
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
    // Dynamic import to avoid build errors if package is not installed
    const { Resend } = await import("resend")
    return new Resend(apiKey)
  } catch (error) {
    console.error("[RESEND] Failed to initialize Resend client:", error)
    return null
  }
}

export async function getNotificationPreferences() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
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
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", success: false }
  }

  // Check if preferences exist
  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("notification_preferences")
      .update(preferences)
      .eq("user_id", user.id)

    if (error) {
      return { error: error.message, success: false }
    }
  } else {
    // Create new
    const { error } = await supabase
      .from("notification_preferences")
      .insert({
        user_id: user.id,
        ...preferences,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings")
  return { success: true, error: null }
}

// Function to send notifications (to be called when events happen)
export async function sendNotification(
  userId: string,
  type: "route_update" | "load_update" | "maintenance_alert" | "payment_reminder",
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
      // Get Resend client
      const resend = await getResendClient()
      
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
      const smsResult = await sendSMSNotification(userId, type, data)
      results.sms = smsResult
    } catch (error: any) {
      console.error("[SMS NOTIFICATION ERROR]", error)
      results.sms = { sent: false, reason: error?.message || "Failed to send SMS" }
    }
  }

  const emailSent = results.email?.sent || false
  const smsSent = results.sms?.sent || false

  return {
    sent: emailSent || smsSent,
    email: results.email,
    sms: results.sms,
    reason: emailSent || smsSent ? null : "User has disabled this notification type or service not configured",
  }
}

// Helper function to generate email content
function getEmailContent(
  type: "route_update" | "load_update" | "maintenance_alert" | "payment_reminder",
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
              <p>Hello ${userName},</p>
              <p>Your route <strong>${data.routeName || "Route"}</strong> has been updated.</p>
              ${data.status ? `<p><strong>New Status:</strong> ${data.status}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${data.origin} → ${data.destination}</p>` : ""}
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
              <p>Hello ${userName},</p>
              <p>Your load <strong>${data.shipmentNumber || "Load"}</strong> status has been updated.</p>
              ${data.status ? `<p><strong>New Status:</strong> ${data.status}</p>` : ""}
              ${data.origin && data.destination ? `<p><strong>Route:</strong> ${data.origin} → ${data.destination}</p>` : ""}
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
              <p>Hello ${userName},</p>
              <p>Maintenance is scheduled for <strong>${data.truckNumber || "your vehicle"}</strong>.</p>
              ${data.serviceType ? `<p><strong>Service Type:</strong> ${data.serviceType}</p>` : ""}
              ${data.scheduledDate ? `<p><strong>Scheduled Date:</strong> ${new Date(data.scheduledDate).toLocaleDateString()}</p>` : ""}
              ${data.priority === "high" ? `<p style="color: #dc2626;"><strong>Priority: High</strong></p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/maintenance" class="button">View Maintenance</a>
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
              <p>Hello ${userName},</p>
              <p>A payment reminder for <strong>${data.driverName || "driver"}</strong>.</p>
              ${data.amount ? `<p><strong>Amount:</strong> $${parseFloat(data.amount).toFixed(2)}</p>` : ""}
              ${data.period ? `<p><strong>Period:</strong> ${data.period}</p>` : ""}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/dashboard/accounting/settlements" class="button">View Settlement</a>
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
        html: `<p>Hello ${userName},</p><p>You have a new notification.</p>`,
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
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { sent: false, error: "Not authenticated" }
  }

  // Get user email and name
  const { data: userData } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", user.id)
    .single()

  if (!userData?.email) {
    return { sent: false, error: "User email not found" }
  }

  // Get Resend client
  const resend = await getResendClient()
  
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

