"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"
import { handleDbError } from "@/lib/db-helpers"

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
 * Get active alerts with role-based filtering
 */
export async function getAlerts(filters?: {
  status?: string
  priority?: string
  event_type?: string
  limit?: number
  role_filter?: boolean // If true, filter by user role
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
    .select("company_id, role, driver_id")
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

  // Role-based filtering (if enabled)
  if (filters?.role_filter !== false) {
    const userRole = userData.role || "driver"
    
    // Define role-based event type filters
    const roleEventTypes: Record<string, string[]> = {
      driver: ["hos_violation", "hos_alert", "dvir_required", "check_call", "load_assigned", "route_update"],
      dispatcher: ["load_status_change", "driver_late", "check_call_missed", "delivery_window", "route_update"],
      manager: ["*"], // Managers see all alerts
      fleet_manager: ["maintenance_due", "maintenance_overdue", "insurance_expiration", "license_renewal", "dvir_required"],
      maintenance_manager: ["maintenance_due", "maintenance_overdue", "dvir_required", "fault_code_detected"],
      safety_manager: ["hos_violation", "dvir_required", "insurance_expiration", "license_renewal"],
    }
    
    const allowedEventTypes = roleEventTypes[userRole] || roleEventTypes.driver
    
    // If not manager (who sees all), filter by event type
    if (userRole !== "manager" && userRole !== "owner" && !allowedEventTypes.includes("*")) {
      query = query.in("event_type", allowedEventTypes)
    }
    
    // Drivers only see alerts for their assigned loads/routes
    if (userRole === "driver" && userData.driver_id) {
      query = query.or(`driver_id.eq.${userData.driver_id},driver_id.is.null`)
    }
  }

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

  // Send notifications based on alert rule and priority
  if (alertRule && alertRule.is_active) {
    const priority = formData.priority || alertRule.priority || "normal"
    const notifyUserIds = alertRule.notify_users || []
    
    // If no specific users, notify all company users (filtered by role)
    if (notifyUserIds.length === 0) {
      const { data: companyUsers } = await supabase
        .from("users")
        .select("id, role")
        .eq("company_id", userData.company_id)
      
      if (companyUsers) {
        // Filter by role-based event type visibility
        const roleEventTypes: Record<string, string[]> = {
          driver: ["hos_violation", "hos_alert", "dvir_required", "check_call", "load_assigned"],
          dispatcher: ["load_status_change", "driver_late", "check_call_missed", "delivery_window"],
          manager: ["*"],
          fleet_manager: ["maintenance_due", "maintenance_overdue", "insurance_expiration"],
          maintenance_manager: ["maintenance_due", "maintenance_overdue", "dvir_required"],
        }
        
        const filteredUsers = companyUsers.filter((u) => {
          const allowedTypes = roleEventTypes[u.role || "driver"] || roleEventTypes.driver
          return allowedTypes.includes("*") || allowedTypes.includes(formData.event_type)
        })
        
        notifyUserIds.push(...filteredUsers.map(u => u.id))
      }
    }

    // Determine notification channels based on priority
    const sendPush = priority === "critical" || priority === "high"
    const sendSMS = priority === "critical"
    const sendEmail = priority !== "low" // All except low priority
    const sendInApp = true // Always send in-app

    // Send notifications
    for (const userId of notifyUserIds) {
      // Push notification via Realtime (for critical/high priority)
      if (sendPush && alertRule.send_in_app !== false) {
        // Create in-app notification record for Realtime subscription
        // Note: notifications table may not exist, that's okay
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: formData.title,
            message: formData.message,
            type: "alert",
            priority: priority,
            metadata: {
              alert_id: alert.id,
              event_type: formData.event_type,
            },
            read: false,
          })
          .catch(() => {
            // Notifications table might not exist, that's okay
          })
      }
      
      // SMS (critical only)
      if (sendSMS && alertRule.send_sms) {
        const { sendSMSNotification } = await import("./sms")
        await sendSMSNotification(userId, "load_update" as any, {
          title: formData.title,
          message: formData.message,
        }).catch(() => {
          // SMS might fail, continue with other channels
        })
      }
      
      // Email (all except low priority)
      if (sendEmail && alertRule.send_email) {
        await sendNotification(userId, "load_update" as any, {
          title: formData.title,
          message: formData.message,
        }).catch(() => {
          // Email might fail, continue
        })
      }
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

