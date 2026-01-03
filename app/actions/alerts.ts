"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"

/**
 * Get alert rules
 */
export async function getAlertRules() {
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

  const { data, error } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    const result = handleDbError(error, [])
    if (result.error) return result
    return { data: result.data, error: null }
  }

  return { data: data || [], error: null }
}

/**
 * Create alert rule
 */
export async function createAlertRule(formData: {
  name: string
  description?: string
  event_type: string
  conditions: any
  send_email?: boolean
  send_sms?: boolean
  send_in_app?: boolean
  notify_users?: string[]
  escalation_enabled?: boolean
  escalation_delay_minutes?: number
  priority?: string
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
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== 'manager') {
    return { error: "Only managers can create alert rules", data: null }
  }

  const { data, error } = await supabase
    .from("alert_rules")
    .insert({
      company_id: userData.company_id,
      name: formData.name,
      description: formData.description || null,
      event_type: formData.event_type,
      conditions: formData.conditions,
      send_email: formData.send_email || false,
      send_sms: formData.send_sms || false,
      send_in_app: formData.send_in_app !== false,
      notify_users: formData.notify_users || [],
      escalation_enabled: formData.escalation_enabled || false,
      escalation_delay_minutes: formData.escalation_delay_minutes || 30,
      priority: formData.priority || 'normal',
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/alerts")
  return { data, error: null }
}

/**
 * Get active alerts
 */
export async function getAlerts(filters?: {
  status?: string
  priority?: string
  event_type?: string
  limit?: number
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
    .from("alerts")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority)
  }
  if (filters?.event_type) {
    query = query.eq("event_type", filters.event_type)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
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
 * Create alert (triggered by events)
 */
export async function createAlert(formData: {
  alert_rule_id?: string
  title: string
  message: string
  event_type: string
  priority?: string
  load_id?: string
  route_id?: string
  driver_id?: string
  truck_id?: string
  metadata?: any
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

  // Get alert rule if provided
  let alertRule = null
  if (formData.alert_rule_id) {
    const { data: rule } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("id", formData.alert_rule_id)
      .eq("company_id", userData.company_id)
      .single()
    alertRule = rule
  }

  // Create alert
  const { data: alert, error: alertError } = await supabase
    .from("alerts")
    .insert({
      company_id: userData.company_id,
      alert_rule_id: formData.alert_rule_id || null,
      title: formData.title,
      message: formData.message,
      event_type: formData.event_type,
      priority: formData.priority || 'normal',
      load_id: formData.load_id || null,
      route_id: formData.route_id || null,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      metadata: formData.metadata || null,
      status: 'active',
    })
    .select()
    .single()

  if (alertError) {
    const result = handleDbError(alertError, null)
    if (result.error) return result
    return { error: "Table not available. Please run the SQL schema.", data: null }
  }

  // Send notifications based on alert rule
  if (alertRule && alertRule.is_active) {
    const notifyUserIds = alertRule.notify_users || []
    
    // If no specific users, notify all company users
    if (notifyUserIds.length === 0) {
      const { data: companyUsers } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", userData.company_id)
      
      if (companyUsers) {
        notifyUserIds.push(...companyUsers.map(u => u.id))
      }
    }

    // Send notifications
    for (const userId of notifyUserIds) {
      if (alertRule.send_email) {
        await sendNotification(userId, "load_update" as any, {
          title: formData.title,
          message: formData.message,
        })
      }
      // SMS and in-app notifications would be handled here
    }
  }

  revalidatePath("/dashboard/alerts")
  return { data: alert, error: null }
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(id: string) {
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

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: 'acknowledged',
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/alerts")
  return { data, error: null }
}

/**
 * Resolve alert
 */
export async function resolveAlert(id: string) {
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

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
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

  revalidatePath("/dashboard/alerts")
  return { data, error: null }
}

