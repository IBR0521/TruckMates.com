"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getReminderSettings() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  const { data, error } = await supabase
    .from("company_reminder_settings")
    .select("*")
    .eq("company_id", result.company_id)
    .single()

  if (error && error.code !== "PGRST116") {
    return { error: error.message, data: null }
  }

  // Return defaults if no settings exist
  if (!data) {
    return {
      data: {
        email_enabled: true,
        sms_enabled: false,
        maintenance_reminders: true,
        license_expiry_reminders: true,
        insurance_expiry_reminders: true,
        invoice_reminders: true,
        load_reminders: true,
        route_reminders: true,
        days_before_reminder: 7,
        reminder_frequency: "daily",
      },
      error: null,
    }
  }

  return { data, error: null }
}

export async function updateReminderSettings(settings: {
  email_enabled?: boolean
  sms_enabled?: boolean
  maintenance_reminders?: boolean
  license_expiry_reminders?: boolean
  insurance_expiry_reminders?: boolean
  invoice_reminders?: boolean
  load_reminders?: boolean
  route_reminders?: boolean
  days_before_reminder?: number
  reminder_frequency?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", success: false }
  }

  // SECURITY FIX 1: Role check - only managers, admins, and owners can update settings
  const { data: userData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single()

  if (!userData) {
    return { error: "User not found", success: false }
  }

  // HIGH FIX 1: Fix role check - use correct role names (manager, admin, owner)
  const MANAGER_ROLES = ["manager", "admin", "owner"]
  if (!MANAGER_ROLES.includes(userData.role)) {
    return { error: "Only managers can update reminder settings", success: false }
  }

  if (!userData.company_id) {
    return { error: "No company found", success: false }
  }

  // LOW FIX 20: Validate reminder_frequency
  if (settings.reminder_frequency !== undefined) {
    const validFrequencies = ["daily", "weekly", "monthly"]
    if (!validFrequencies.includes(settings.reminder_frequency)) {
      return { error: `Reminder frequency must be one of: ${validFrequencies.join(", ")}`, success: false }
    }
  }

  // MEDIUM FIX 17: Build explicit updateData object to prevent column injection
  const updateData: any = {
    company_id: userData.company_id,
  }
  if (settings.email_enabled !== undefined) updateData.email_enabled = settings.email_enabled
  if (settings.sms_enabled !== undefined) updateData.sms_enabled = settings.sms_enabled
  if (settings.maintenance_reminders !== undefined) updateData.maintenance_reminders = settings.maintenance_reminders
  if (settings.license_expiry_reminders !== undefined) updateData.license_expiry_reminders = settings.license_expiry_reminders
  if (settings.insurance_expiry_reminders !== undefined) updateData.insurance_expiry_reminders = settings.insurance_expiry_reminders
  if (settings.invoice_reminders !== undefined) updateData.invoice_reminders = settings.invoice_reminders
  if (settings.load_reminders !== undefined) updateData.load_reminders = settings.load_reminders
  if (settings.route_reminders !== undefined) updateData.route_reminders = settings.route_reminders
  if (settings.days_before_reminder !== undefined) updateData.days_before_reminder = settings.days_before_reminder
  if (settings.reminder_frequency !== undefined) updateData.reminder_frequency = settings.reminder_frequency

  // MEDIUM FIX 1: Use atomic upsert to prevent race condition
  const { error } = await supabase
    .from("company_reminder_settings")
    .upsert(
      updateData,
      {
        onConflict: "company_id",
      }
    )

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath("/dashboard/settings/reminder")
  return { success: true, error: null }
}












