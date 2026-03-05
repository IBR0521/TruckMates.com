"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"
import { handleDbError } from "@/lib/db-helpers"

/**
 * Get reminders
 */
export async function getReminders(filters?: {
  reminder_type?: string
  status?: string
  due_date_start?: string
  due_date_end?: string
}) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (userError) {
      return { error: userError.message || "Failed to fetch user data", data: null }
    }

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    let query = supabase
      .from("reminders")
      .select("*")
      .eq("company_id", userData.company_id)
      .order("due_date", { ascending: true })

    if (filters?.reminder_type) {
      query = query.eq("reminder_type", filters.reminder_type)
    }
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }
    if (filters?.due_date_start) {
      query = query.gte("due_date", filters.due_date_start)
    }
    if (filters?.due_date_end) {
      query = query.lte("due_date", filters.due_date_end)
    }

    const { data, error } = await query

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { data: [], error: null }
      }
      const result = handleDbError(error, [])
      if (result.error) return result
      return { data: result.data, error: null }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("Error in getReminders:", error)
    // LOW FIX 4: Return actual error for non-table-missing errors
    // Only suppress the 'table does not exist' error with empty array fallback
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return { data: [], error: null }
    }
    return { data: null, error: error?.message || "Failed to load reminders" }
  }
}

/**
 * Create reminder
 */
export async function createReminder(formData: {
  title: string
  description?: string
  reminder_type: string
  due_date: string
  due_time?: string
  reminder_date?: string
  reminder_time?: string
  is_recurring?: boolean
  recurrence_pattern?: string
  recurrence_interval?: number
  truck_id?: string
  driver_id?: string
  load_id?: string
  invoice_id?: string
  notify_users?: string[]
  send_email?: boolean
  send_sms?: boolean
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // CRITICAL FIX 1: Validate due_date is in the future
  const dueDateObj = new Date(formData.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (dueDateObj < today) {
    return { error: "Due date must be in the future", data: null }
  }

  // CRITICAL FIX 6: Read company reminder settings
  const { data: settings } = await supabase
    .from("company_reminder_settings")
    .select("*")
    .eq("company_id", userData.company_id)
    .single()

  const daysBeforeReminder = settings?.days_before_reminder || 1

  // Calculate reminder date if not provided (use company settings)
  let reminderDate = formData.reminder_date
  if (!reminderDate) {
    const dueDate = new Date(formData.due_date)
    dueDate.setDate(dueDate.getDate() - daysBeforeReminder)
    // Clamp reminder_date to today if it calculates to the past
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    if (dueDate < todayDate) {
      reminderDate = todayDate.toISOString().split('T')[0]
    } else {
      reminderDate = dueDate.toISOString().split('T')[0]
    }
  }

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      company_id: userData.company_id,
      title: formData.title,
      description: formData.description || null,
      reminder_type: formData.reminder_type,
      due_date: formData.due_date,
      due_time: formData.due_time || null,
      reminder_date: reminderDate,
      reminder_time: formData.reminder_time || null,
      is_recurring: formData.is_recurring || false,
      recurrence_pattern: formData.recurrence_pattern || null,
      recurrence_interval: formData.recurrence_interval || 1,
      truck_id: formData.truck_id || null,
      driver_id: formData.driver_id || null,
      load_id: formData.load_id || null,
      invoice_id: formData.invoice_id || null,
      notify_users: formData.notify_users || [],
      send_email: formData.send_email !== false,
      send_sms: formData.send_sms || false,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  // CRITICAL FIX 1: Send notifications if enabled
  if (data && (formData.send_email || formData.send_sms)) {
    // Get users to notify (from notify_users or all company managers)
    let userIdsToNotify = formData.notify_users || []
    if (userIdsToNotify.length === 0) {
      const { data: managers } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", userData.company_id)
        .in("role", ["manager", "admin", "owner"])
      if (managers) {
        userIdsToNotify = managers.map((m: { id: string; [key: string]: any }) => m.id)
      }
    }

    // Send notifications to each user
    for (const userId of userIdsToNotify) {
      try {
        await sendNotification(userId, "reminder_due", {
          title: data.title,
          description: data.description,
          due_date: data.due_date,
          reminder_type: data.reminder_type,
        })
      } catch (error: any) {
        console.error(`[REMINDER] Failed to send notification to user ${userId}:`, error)
        // Don't fail the entire operation if notification fails
      }
    }
  }

  revalidatePath("/dashboard/reminders")
  return { data, error: null }
}

/**
 * Complete reminder
 */
export async function completeReminder(id: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (userError) {
      return { error: userError.message || "Failed to fetch user data", data: null }
    }

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    // Get reminder to check if recurring
    const { data: reminder, error: reminderError } = await supabase
      .from("reminders")
      .select("*")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .single()

    if (reminderError) {
      // If table doesn't exist, return error gracefully
      if (reminderError.code === "42P01" || reminderError.message?.includes("does not exist")) {
        return { error: "Reminders table not available", data: null }
      }
      return { error: "Reminder not found", data: null }
    }

    if (!reminder) {
      return { error: "Reminder not found", data: null }
    }

  // Update reminder
  const { data, error } = await supabase
    .from("reminders")
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    const result = handleDbError(error, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  // If recurring, create next reminder
  if (reminder.is_recurring && reminder.recurrence_pattern) {
    const nextDueDate = calculateNextDueDate(
      reminder.due_date,
      reminder.recurrence_pattern,
      reminder.recurrence_interval
    )

    if (nextDueDate) {
      // Get company settings for days_before_reminder
      const { data: settings } = await supabase
        .from("company_reminder_settings")
        .select("days_before_reminder")
        .eq("company_id", userData.company_id)
        .single()

      const daysBeforeReminder = settings?.days_before_reminder || 1

      // Calculate reminder date for next occurrence
      const nextReminderDate = new Date(nextDueDate)
      nextReminderDate.setDate(nextReminderDate.getDate() - daysBeforeReminder)
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      // Clamp to today if in the past
      const nextReminderDateStr = nextReminderDate < todayDate
        ? todayDate.toISOString().split('T')[0]
        : nextReminderDate.toISOString().split('T')[0]

      // HIGH FIX 2: Check for insert errors and return warning
      const { error: insertError } = await supabase
        .from("reminders")
        .insert({
          company_id: userData.company_id,
          title: reminder.title,
          description: reminder.description,
          reminder_type: reminder.reminder_type,
          due_date: nextDueDate,
          due_time: reminder.due_time,
          reminder_date: nextReminderDateStr,
          reminder_time: reminder.reminder_time,
          is_recurring: true,
          recurrence_pattern: reminder.recurrence_pattern,
          recurrence_interval: reminder.recurrence_interval,
          truck_id: reminder.truck_id,
          driver_id: reminder.driver_id,
          load_id: reminder.load_id,
          invoice_id: reminder.invoice_id,
          notify_users: reminder.notify_users,
          send_email: reminder.send_email,
          send_sms: reminder.send_sms,
          status: 'pending',
        })

      if (insertError) {
        console.error("[REMINDER] Failed to schedule next occurrence:", insertError)
        return {
          data,
          error: null,
          warning: `Reminder completed but failed to schedule next occurrence: ${insertError.message}`,
        }
      }
    }
  }

    revalidatePath("/dashboard/reminders")
    return { data, error: null }
  } catch (error: any) {
    console.error("Error in completeReminder:", error)
    // Return error gracefully to prevent server crashes
    return { error: error?.message || "Failed to complete reminder", data: null }
  }
}

/**
 * Calculate next due date for recurring reminders
 * CRITICAL FIX 3: Clamp month-end dates to prevent overflow
 */
function calculateNextDueDate(
  currentDueDate: string,
  pattern: string,
  interval: number
): string | null {
  const date = new Date(currentDueDate)
  const originalDay = date.getDate()

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval))
      break
    case 'monthly':
      // CRITICAL FIX 3: Clamp to last valid day of target month to prevent overflow
      const year = date.getFullYear()
      const targetMonth = date.getMonth() + interval
      const lastDayOfTargetMonth = new Date(year, targetMonth + 1, 0).getDate()
      const targetDay = Math.min(originalDay, lastDayOfTargetMonth)
      date.setFullYear(year, targetMonth, targetDay)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval)
      break
    default:
      return null
  }

  return date.toISOString().split('T')[0]
}

/**
 * Get overdue reminders
 */
export async function getOverdueReminders() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (userError) {
      return { error: userError.message || "Failed to fetch user data", data: null }
    }

    if (!userData?.company_id) {
      return { error: "No company found", data: null }
    }

    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("company_id", userData.company_id)
      .eq("status", "pending")
      .lt("due_date", today)
      .order("due_date", { ascending: true })

    if (error) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { data: [], error: null }
      }
      const result = handleDbError(error, [])
      if (result.error) return result
      return { data: result.data, error: null }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error("Error in getOverdueReminders:", error)
    // LOW FIX 4: Return actual error for non-table-missing errors
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return { data: [], error: null }
    }
    return { data: null, error: error?.message || "Failed to load overdue reminders" }
  }
}

/**
 * Update reminder
 */
export async function updateReminder(
  id: string,
  formData: {
    title?: string
    description?: string
    reminder_type?: string
    due_date?: string
    due_time?: string
    reminder_date?: string
    reminder_time?: string
    is_recurring?: boolean
    recurrence_pattern?: string
    recurrence_interval?: number
  }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (userError || !userData?.company_id) {
      return { error: userError?.message || "No company found", data: null }
    }

    // Validate due_date if provided
    if (formData.due_date) {
      const dueDateObj = new Date(formData.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (dueDateObj < today) {
        return { error: "Due date must be in the future", data: null }
      }
    }

    const { data, error } = await supabase
      .from("reminders")
      .update(formData)
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .select()
      .single()

    if (error) {
      const result = handleDbError(error, null)
      if (result.error) return result
      return { error: "Failed to update reminder", data: null }
    }

    revalidatePath("/dashboard/reminders")
    return { data, error: null }
  } catch (error: any) {
    console.error("Error in updateReminder:", error)
    return { error: error?.message || "Failed to update reminder", data: null }
  }
}

/**
 * Delete reminder
 */
export async function deleteReminder(id: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated", data: null }
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (userError || !userData?.company_id) {
      return { error: userError?.message || "No company found", data: null }
    }

    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("company_id", userData.company_id)

    if (error) {
      const result = handleDbError(error, null)
      if (result.error) return result
      return { error: "Failed to delete reminder", data: null }
    }

    revalidatePath("/dashboard/reminders")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    console.error("Error in deleteReminder:", error)
    return { error: error?.message || "Failed to delete reminder", data: null }
  }
}

