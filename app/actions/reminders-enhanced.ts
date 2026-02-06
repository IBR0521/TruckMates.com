"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    // Call the database function
    const { data, error } = await supabase.rpc("auto_create_maintenance_reminders_from_schedule")

    if (error) {
      console.error("Error auto-creating maintenance reminders:", error)
      return { error: error.message, data: null }
    }

    return { data: { created: data || 0 }, error: null }
  } catch (error: any) {
    console.error("Unhandled error in autoCreateMaintenanceReminders:", error)
    return { error: error.message || "Failed to create reminders", data: null }
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  try {
    // Get overdue reminders
    const { data: overdue, error: overdueError } = await supabase
      .from("reminders")
      .select("*")
      .eq("company_id", result.company_id)
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString().split("T")[0])
      .order("due_date", { ascending: true })
      .limit(limit)

    // Get upcoming reminders (next 7 days)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const { data: upcoming, error: upcomingError } = await supabase
      .from("reminders")
      .select("*")
      .eq("company_id", result.company_id)
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
  } catch (error: any) {
    console.error("Unhandled error in getDashboardReminders:", error)
    return { error: error.message || "Failed to get reminders", data: null }
  }
}


