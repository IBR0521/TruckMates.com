"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"
import { sanitizeError } from "@/lib/error-message"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export async function getReminderSettings() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_reminder_settings")
    .select(
      "id, company_id, email_enabled, sms_enabled, maintenance_reminders, license_expiry_reminders, insurance_expiry_reminders, invoice_reminders, load_reminders, route_reminders, days_before_reminder, reminder_frequency, created_at, updated_at",
    )
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) {
    return { error: safeDbError(error), data: null }
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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", success: false }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update reminder settings", success: false }
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
    company_id: ctx.companyId,
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
    return { error: safeDbError(error), success: false }
  }

  revalidatePath("/dashboard/settings/reminder")
  return { success: true, error: null }
}












