"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"

/** Matches `public.reminders` in supabase/trucklogics_features_schema.sql */
const REMINDERS_SELECT = `
  id, company_id, title, description, reminder_type,
  due_date, due_time, reminder_date, reminder_time,
  is_recurring, recurrence_pattern, recurrence_interval,
  truck_id, driver_id, load_id, invoice_id,
  status, completed_at, completed_by,
  notify_users, send_email, send_sms,
  created_at, updated_at
`

/**
 * Enhanced Reminders Actions
 * Includes maintenance integration and mileage-based reminders
 */

/**
 * Auto-create maintenance reminders from schedule
 */
export async function autoCreateMaintenanceReminders(): Promise<{
  data: { created: number } | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data, error } = await supabase.rpc("auto_create_maintenance_reminders_from_schedule", {
      p_company_id: ctx.companyId,
    })

    if (error) {
      Sentry.captureException(error)
      return { error: error.message, data: null }
    }

    return { data: { created: data || 0 }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to create reminders"
    return { error: message, data: null }
  }
}

/**
 * Get reminders for dashboard widget
 */
export async function getDashboardReminders(limit: number = 5): Promise<{
  data: any[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: overdue, error: overdueError } = await supabase
      .from("reminders")
      .select(REMINDERS_SELECT)
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString().split("T")[0])
      .order("due_date", { ascending: true })
      .limit(limit)

    // Get upcoming reminders (next 7 days)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const { data: upcoming, error: upcomingError } = await supabase
      .from("reminders")
      .select(REMINDERS_SELECT)
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")
      .gte("due_date", new Date().toISOString().split("T")[0])
      .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0])
      .order("due_date", { ascending: true })
      .limit(limit)

    if (overdueError || upcomingError) {
      return { error: overdueError?.message || upcomingError?.message || "Failed to fetch reminders", data: null }
    }

    // Combine and sort: overdue first, then by due date
    const allReminders = [
      ...(overdue || []).map((r: any) => ({ ...r, isOverdue: true })),
      ...(upcoming || []).map((r: any) => ({ ...r, isOverdue: false })),
    ].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    return { data: allReminders.slice(0, limit), error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to get reminders"
    return { error: message, data: null }
  }
}



