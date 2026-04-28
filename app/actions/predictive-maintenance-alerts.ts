"use server"

/**
 * Predictive Maintenance SMS Alerts
 * Send SMS alerts 500 miles before maintenance is due
 */

import { createClient } from "@/lib/supabase/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { sendSMSNotification } from "./sms"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Check and send maintenance alerts for a truck
 * Called automatically when truck mileage is updated
 */
export async function checkAndSendMaintenanceAlerts(
  truckId: string,
  currentMileage: number,
  companyId?: string // FIXED: Accept companyId parameter for background operations
) {
  // FIXED: Remove auth requirement - this function is called from background triggers
  // Get company_id from truck record (works for both authenticated and background calls)
  const supabase = await createClient()
  
  const { data: truckData, error: truckError } = await supabase
    .from("trucks")
    .select("company_id")
    .eq("id", truckId)
    .single()
  
  if (truckError || !truckData) {
    if (truckError) Sentry.captureException(truckError)
    return { error: "Truck not found", data: null }
  }

  const targetCompanyId = companyId || truckData?.company_id

  if (!targetCompanyId) {
    return { error: "No company found for truck", data: null }
  }

  try {
    // Call database function to check for alerts
    const { data: alertsCount, error } = await supabase.rpc('check_and_send_maintenance_alerts', {
      p_truck_id: truckId,
      p_current_mileage: Math.floor(currentMileage)
    })

    if (error) {
      Sentry.captureException(error)
      return { error: safeDbError(error), data: null }
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
      Sentry.captureException(alertsError)
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
        if (manager?.id) {
          const { sendPushToUser } = await import("./push-notifications")
          await sendPushToUser(manager.id, {
            title: `Maintenance alert: ${truck?.truck_number || "Truck"}`,
            body: `${alert.service_type} due in ${alert.miles_remaining} miles`,
            data: {
              type: "maintenance_alert",
              truckId: String(truckId),
              link: `/dashboard/maintenance`,
            },
          })
        }
      } catch (smsError: unknown) {
        Sentry.captureException(smsError)
        await supabase
          .from("maintenance_alert_notifications")
          .update({ status: "failed", error_message: errorMessage(smsError) })
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
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to check maintenance alerts"), data: null }
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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("maintenance_alert_notifications")
      .select(`
        *,
        trucks:truck_id (id, truck_number, make, model),
        users:sent_to (id, name, phone)
      `)
      .eq("company_id", ctx.companyId)
      // FIXED: Order by sent_at NULLS LAST to handle pending records with NULL sent_at
      .order("sent_at", { ascending: false, nullsFirst: false })

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
      return { error: safeDbError(error), data: null }
    }

    return { data: alerts || [], error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get alert history"), data: null }
  }
}



