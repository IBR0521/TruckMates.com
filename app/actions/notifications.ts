"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
  let shouldNotify = false
  switch (type) {
    case "route_update":
      shouldNotify = preferences.route_updates && preferences.email_alerts
      break
    case "load_update":
      shouldNotify = preferences.load_updates && preferences.email_alerts
      break
    case "maintenance_alert":
      shouldNotify = preferences.maintenance_alerts && preferences.email_alerts
      break
    case "payment_reminder":
      shouldNotify = preferences.payment_reminders && preferences.email_alerts
      break
  }

  if (!shouldNotify) {
    return { sent: false, reason: "User has disabled this notification type" }
  }

  // Get user email
  const { data: userData } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single()

  if (!userData?.email) {
    return { sent: false, reason: "User email not found" }
  }

  // TODO: Implement actual email sending
  // For now, we'll use Supabase's built-in email or integrate with a service like Resend
  // This is a placeholder - you'll need to set up email sending
  
  console.log(`[NOTIFICATION] Would send ${type} to ${userData.email}`, data)
  
  // In production, you would:
  // 1. Use Supabase Edge Functions to send emails
  // 2. Or use a service like Resend, SendGrid, etc.
  // 3. Or use Supabase's built-in email templates
  
  return { sent: true, email: userData.email }
}

