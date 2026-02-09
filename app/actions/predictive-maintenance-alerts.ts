"use server"

/**
 * Predictive Maintenance SMS Alerts
 * Send SMS alerts 500 miles before maintenance is due
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { sendSMSNotification } from "./sms"

/**
 * Check and send maintenance alerts for a truck
 * Called automatically when truck mileage is updated
 */
export async function checkAndSendMaintenanceAlerts(
  truckId: string,
  currentMileage: number
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    // Call database function to check for alerts
    const { data: alertsCount, error } = await supabase.rpc('check_and_send_maintenance_alerts', {
      p_truck_id: truckId,
      p_current_mileage: Math.floor(currentMileage)
    })

    if (error) {
      console.error("Failed to check maintenance alerts:", error)
      return { error: error.message, data: null }
    }

    // Get pending alerts that need SMS
    const { data: pendingAlerts, error: alertsError } = await supabase
      .from("maintenance_alert_notifications")
      .select(`
        *,
        trucks:truck_id (id, truck_number, make, model),
        users:sent_to (id, phone, name)
      `)
      .eq("truck_id", truckId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (alertsError) {
      console.error("Failed to get pending alerts:", alertsError)
      return { data: { alerts_checked: alertsCount || 0, alerts_sent: 0 }, error: null }
    }

    // Send SMS for each pending alert
    let alertsSent = 0
    for (const alert of pendingAlerts || []) {
      const truck = (alert as any).trucks
      const manager = (alert as any).users

      if (!manager?.phone) {
        // Update status to failed
        await supabase
          .from("maintenance_alert_notifications")
          .update({ status: "failed", error_message: "Fleet manager phone number not found" })
          .eq("id", alert.id)
        continue
      }

      // Generate SMS message
      const message = `🚨 TruckMates Maintenance Alert\n\n` +
        `Truck: ${truck?.truck_number || "Unknown"} (${truck?.make || ""} ${truck?.model || ""})\n` +
        `Service: ${alert.service_type}\n` +
        `Current Mileage: ${alert.alert_mileage.toLocaleString()} miles\n` +
        `Service Due: ${alert.target_mileage.toLocaleString()} miles\n` +
        `Miles Remaining: ${alert.miles_remaining.toLocaleString()} miles\n\n` +
        `Schedule maintenance soon to avoid breakdowns!`

      // Send SMS
      try {
        const { sendSMS } = await import("./sms")
        const smsResult = await sendSMS(manager.phone, message)

        // Update alert status
        await supabase
          .from("maintenance_alert_notifications")
          .update({
            status: smsResult.sent ? "sent" : "failed",
            error_message: smsResult.error || null
          })
          .eq("id", alert.id)

        if (smsResult.sent) {
          alertsSent++
        }
      } catch (smsError: any) {
        console.error("Failed to send SMS:", smsError)
        await supabase
          .from("maintenance_alert_notifications")
          .update({ status: "failed", error_message: smsError.message })
          .eq("id", alert.id)
      }
    }

    return {
      data: {
        alerts_checked: alertsCount || 0,
        alerts_sent: alertsSent
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || "Failed to check maintenance alerts", data: null }
  }
}

/**
 * Get maintenance alert history
 */
export async function getMaintenanceAlertHistory(filters?: {
  truck_id?: string
  service_type?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let query = supabase
      .from("maintenance_alert_notifications")
      .select(`
        *,
        trucks:truck_id (id, truck_number, make, model),
        users:sent_to (id, name, phone)
      `)
      .eq("company_id", company_id)
      .order("sent_at", { ascending: false })

    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.service_type) {
      query = query.eq("service_type", filters.service_type)
    }
    if (filters?.start_date) {
      query = query.gte("sent_at", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("sent_at", filters.end_date)
    }

    const { data: alerts, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: alerts || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get alert history", data: null }
  }
}



