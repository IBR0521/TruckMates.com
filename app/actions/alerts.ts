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

  // FIXED: Allow admin and owner roles to create alert rules
  if (!['manager', 'admin', 'owner'].includes(userData.role || '')) {
    return { error: "Only managers, admins, and owners can create alert rules", data: null }
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
      // NOTE: escalation_enabled is stored but not yet implemented
      // The escalation feature (checking, scheduling, timers) is not implemented
      // This field is stored for future use but currently has no effect
      escalation_enabled: formData.escalation_enabled || false,
      // FIXED: Add server-side validation for escalation_delay_minutes
      escalation_delay_minutes: formData.escalation_enabled 
        ? (formData.escalation_delay_minutes && formData.escalation_delay_minutes >= 1 && formData.escalation_delay_minutes <= 1440
          ? formData.escalation_delay_minutes 
          : 30)
        : null,
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
 * Update alert rule
 */
export async function updateAlertRule(
  ruleId: string,
  formData: {
    name?: string
    description?: string
    event_type?: string
    conditions?: any
    send_email?: boolean
    send_sms?: boolean
    send_in_app?: boolean
    notify_users?: string[]
    escalation_enabled?: boolean
    escalation_delay_minutes?: number
    priority?: string
    is_active?: boolean
  }
) {
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

  // FIXED: Allow admin and owner roles to update alert rules
  if (!['manager', 'admin', 'owner'].includes(userData.role || '')) {
    return { error: "Only managers, admins, and owners can update alert rules", data: null }
  }

  // Verify the rule belongs to the company
  const { data: existingRule } = await supabase
    .from("alert_rules")
    .select("id, company_id")
    .eq("id", ruleId)
    .eq("company_id", userData.company_id)
    .single()

  if (!existingRule) {
    return { error: "Alert rule not found", data: null }
  }

  const updateData: any = {}
  if (formData.name !== undefined) updateData.name = formData.name
  if (formData.description !== undefined) updateData.description = formData.description || null
  if (formData.event_type !== undefined) updateData.event_type = formData.event_type
  if (formData.conditions !== undefined) updateData.conditions = formData.conditions
  if (formData.send_email !== undefined) updateData.send_email = formData.send_email
  if (formData.send_sms !== undefined) updateData.send_sms = formData.send_sms
  if (formData.send_in_app !== undefined) updateData.send_in_app = formData.send_in_app
  if (formData.notify_users !== undefined) updateData.notify_users = formData.notify_users
  if (formData.escalation_enabled !== undefined) updateData.escalation_enabled = formData.escalation_enabled
  if (formData.escalation_delay_minutes !== undefined) {
    updateData.escalation_delay_minutes = formData.escalation_enabled 
      ? (formData.escalation_delay_minutes && formData.escalation_delay_minutes >= 1 && formData.escalation_delay_minutes <= 1440
        ? formData.escalation_delay_minutes 
        : 30)
      : null
  }
  if (formData.priority !== undefined) updateData.priority = formData.priority
  if (formData.is_active !== undefined) updateData.is_active = formData.is_active

  const { data, error } = await supabase
    .from("alert_rules")
    .update(updateData)
    .eq("id", ruleId)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/alerts")
  return { data, error: null }
}

/**
 * Delete alert rule
 */
export async function deleteAlertRule(ruleId: string) {
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

  // FIXED: Allow admin and owner roles to delete alert rules
  if (!['manager', 'admin', 'owner'].includes(userData.role || '')) {
    return { error: "Only managers, admins, and owners can delete alert rules", data: null }
  }

  // Verify the rule belongs to the company
  const { data: existingRule } = await supabase
    .from("alert_rules")
    .select("id, company_id")
    .eq("id", ruleId)
    .eq("company_id", userData.company_id)
    .single()

  if (!existingRule) {
    return { error: "Alert rule not found", data: null }
  }

  const { error } = await supabase
    .from("alert_rules")
    .delete()
    .eq("id", ruleId)
    .eq("company_id", userData.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/alerts")
  return { data: { success: true }, error: null }
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
        // FIXED: Add 'owner' role with wildcard access (same as manager)
        const roleEventTypes: Record<string, string[]> = {
          driver: ["hos_violation", "hos_alert", "dvir_required", "check_call", "load_assigned"],
          dispatcher: ["load_status_change", "driver_late", "check_call_missed", "delivery_window"],
          manager: ["*"],
          owner: ["*"], // FIXED: Owner should see all alerts like manager
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

    // FIXED: Map event_type to appropriate notification type
    // This ensures correct email/SMS templates are used
    const getNotificationType = (eventType: string): "route_update" | "load_update" | "maintenance_alert" | "payment_reminder" => {
      if (eventType.includes("maintenance") || eventType.includes("service")) {
        return "maintenance_alert"
      }
      if (eventType.includes("payment") || eventType.includes("settlement")) {
        return "payment_reminder"
      }
      if (eventType.includes("route")) {
        return "route_update"
      }
      // Default to load_update for most alerts (load_status_change, etc.)
      return "load_update"
    }

    const notificationType = getNotificationType(formData.event_type)

    // Send notifications
    for (const userId of notifyUserIds) {
      // FIXED: Decouple in-app notification from sendPush flag
      // Create in-app notification record when sendInApp is true and rule allows it
      if (sendInApp && alertRule.send_in_app !== false) {
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
        // FIXED: Use correct notification type instead of hardcoded "load_update"
        await sendSMSNotification(userId, notificationType, {
          title: formData.title,
          message: formData.message,
          shipmentNumber: formData.metadata?.shipment_number,
          truckNumber: formData.metadata?.truck_number,
          driverName: formData.metadata?.driver_name,
          serviceType: formData.metadata?.service_type,
        }).catch(() => {
          // SMS might fail, continue with other channels
        })
      }
      
      // Email (all except low priority)
      if (sendEmail && alertRule.send_email) {
        // FIXED: Use correct notification type instead of hardcoded "load_update"
        await sendNotification(userId, notificationType, {
          title: formData.title,
          message: formData.message,
          shipmentNumber: formData.metadata?.shipment_number,
          routeName: formData.metadata?.route_name,
          truckNumber: formData.metadata?.truck_number,
          driverName: formData.metadata?.driver_name,
          serviceType: formData.metadata?.service_type,
          scheduledDate: formData.metadata?.scheduled_date,
          status: formData.metadata?.status,
          origin: formData.metadata?.origin,
          destination: formData.metadata?.destination,
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

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: 'resolved',
      resolved_by: user.id, // FIXED: Record who resolved the alert
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

