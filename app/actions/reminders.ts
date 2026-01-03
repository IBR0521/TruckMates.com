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
    const result = handleDbError(error, [])
    if (result.error) return result
    return { data: result.data, error: null }
  }

  return { data: data || [], error: null }
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

  // Calculate reminder date if not provided (default to 1 day before due date)
  let reminderDate = formData.reminder_date
  if (!reminderDate) {
    const dueDate = new Date(formData.due_date)
    dueDate.setDate(dueDate.getDate() - 1)
    reminderDate = dueDate.toISOString().split('T')[0]
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

  revalidatePath("/dashboard/reminders")
  return { data, error: null }
}

/**
 * Complete reminder
 */
export async function completeReminder(id: string) {
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

  // Get reminder to check if recurring
  const { data: reminder } = await supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

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
      await supabase
        .from("reminders")
        .insert({
          company_id: userData.company_id,
          title: reminder.title,
          description: reminder.description,
          reminder_type: reminder.reminder_type,
          due_date: nextDueDate,
          due_time: reminder.due_time,
          reminder_date: reminder.reminder_date,
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
    }
  }

  revalidatePath("/dashboard/reminders")
  return { data, error: null }
}

/**
 * Calculate next due date for recurring reminders
 */
function calculateNextDueDate(
  currentDueDate: string,
  pattern: string,
  interval: number
): string | null {
  const date = new Date(currentDueDate)

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval))
      break
    case 'monthly':
      date.setMonth(date.getMonth() + interval)
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

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("company_id", userData.company_id)
    .eq("status", "pending")
    .lt("due_date", today)
    .order("due_date", { ascending: true })

  if (error) {
    const result = handleDbError(error, [])
    if (result.error) return result
    return { data: result.data, error: null }
  }

  return { data: data || [], error: null }
}

