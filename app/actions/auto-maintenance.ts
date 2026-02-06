"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { createMaintenance } from "./maintenance"

/**
 * Auto-schedule maintenance based on mileage thresholds
 * This runs automatically when truck mileage is updated
 */
export async function autoScheduleMaintenanceFromMileage(truckId: string): Promise<{
  data: { scheduled: number; skipped: number } | null
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get truck with current mileage
  const { data: truck, error: truckError } = await supabase
    .from("trucks")
    .select("id, truck_number, current_mileage, make, model, year")
    .eq("id", truckId)
    .eq("company_id", result.company_id)
    .single()

  if (truckError || !truck) {
    return { error: truckError?.message || "Truck not found", data: null }
  }

  const currentMileage = truck.current_mileage || 0

  // Get last maintenance records for this truck
  const { data: recentMaintenance } = await supabase
    .from("maintenance")
    .select("service_type, scheduled_date, current_mileage, status")
    .eq("truck_id", truckId)
    .eq("company_id", result.company_id)
    .in("status", ["scheduled", "in_progress"])
    .order("scheduled_date", { ascending: false })
    .limit(10)

  // Maintenance intervals (miles)
  const maintenanceIntervals: Record<string, number> = {
    "Oil Change": 10000,
    "Tire Rotation": 15000,
    "Brake Inspection": 20000,
    "Brake Service": 50000,
    "Transmission Service": 60000,
    "Major Service": 100000,
  }

  let scheduled = 0
  let skipped = 0

  // Check each maintenance type
  for (const [serviceType, interval] of Object.entries(maintenanceIntervals)) {
    // Check if this service is already scheduled
    const alreadyScheduled = recentMaintenance?.some(
      (m) => m.service_type === serviceType && (m.status === "scheduled" || m.status === "in_progress")
    )

    if (alreadyScheduled) {
      skipped++
      continue
    }

    // Find last time this service was performed
    const { data: lastService } = await supabase
      .from("maintenance")
      .select("current_mileage, scheduled_date")
      .eq("truck_id", truckId)
      .eq("service_type", serviceType)
      .eq("status", "completed")
      .order("scheduled_date", { ascending: false })
      .limit(1)
      .single()

    const lastServiceMileage = lastService?.current_mileage || 0
    const milesSinceLastService = currentMileage - lastServiceMileage

    // If we've exceeded the interval, schedule maintenance
    if (milesSinceLastService >= interval) {
      // Calculate when maintenance should be scheduled (immediately or soon)
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + 7) // Schedule 7 days from now

      // Determine priority based on how overdue
      let priority = "normal"
      if (milesSinceLastService >= interval * 1.5) {
        priority = "high"
      } else if (milesSinceLastService >= interval * 1.2) {
        priority = "medium"
      }

      try {
        const maintenanceResult = await createMaintenance({
          truck_id: truckId,
          service_type: serviceType,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          current_mileage: currentMileage,
          priority: priority,
          notes: `Auto-scheduled: ${milesSinceLastService.toLocaleString()} miles since last ${serviceType.toLowerCase()} (interval: ${interval.toLocaleString()} miles)`,
        })

        if (!maintenanceResult.error) {
          scheduled++
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`[AUTO-MAINTENANCE] Failed to schedule ${serviceType}:`, error)
        skipped++
      }
    }
  }

  revalidatePath("/dashboard/maintenance")
  
  // Check and send predictive maintenance alerts (500 miles before service)
  try {
    const { checkAndSendMaintenanceAlerts } = await import("./predictive-maintenance-alerts")
    await checkAndSendMaintenanceAlerts(truckId, currentMileage)
  } catch (error) {
    console.error("[AUTO-MAINTENANCE] Failed to check maintenance alerts:", error)
    // Don't fail the function if alert check fails
  }
  
  return {
    data: { scheduled, skipped },
    error: null,
  }
}

/**
 * Auto-schedule maintenance for all trucks based on mileage
 * Can be called by a cron job or manually
 */
export async function autoScheduleMaintenanceForAllTrucks(): Promise<{
  data: { trucks_processed: number; total_scheduled: number; total_skipped: number } | null
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Get all active trucks
  const { data: trucks, error: trucksError } = await supabase
    .from("trucks")
    .select("id")
    .eq("company_id", result.company_id)
    .eq("status", "active")

  if (trucksError) {
    return { error: trucksError.message, data: null }
  }

  if (!trucks || trucks.length === 0) {
    return {
      data: { trucks_processed: 0, total_scheduled: 0, total_skipped: 0 },
      error: null,
    }
  }

  let totalScheduled = 0
  let totalSkipped = 0

  // Process each truck
  for (const truck of trucks) {
    const result = await autoScheduleMaintenanceFromMileage(truck.id)
    if (result.data) {
      totalScheduled += result.data.scheduled
      totalSkipped += result.data.skipped
    }
  }

  return {
    data: {
      trucks_processed: trucks.length,
      total_scheduled: totalScheduled,
      total_skipped: totalSkipped,
    },
    error: null,
  }
}



