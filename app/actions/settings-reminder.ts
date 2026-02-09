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

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", success: false }
  }

  // Check if settings exist
  const { data: existing } = await supabase
    .from("company_reminder_settings")
    .select("id")
    .eq("company_id", result.company_id)
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("company_reminder_settings")
      .update(settings)
      .eq("company_id", result.company_id)

    if (error) {
      return { error: error.message, success: false }
    }
  } else {
    // Create new
    const { error } = await supabase
      .from("company_reminder_settings")
      .insert({
        company_id: result.company_id,
        ...settings,
      })

    if (error) {
      return { error: error.message, success: false }
    }
  }

  revalidatePath("/dashboard/settings/reminder")
  return { success: true, error: null }
}












