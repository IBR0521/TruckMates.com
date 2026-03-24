"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createMaintenance } from "./maintenance"

/**
 * Auto-schedule maintenance based on mileage thresholds
 * This runs automatically when truck mileage is updated
 */
export async function autoScheduleMaintenanceFromMileage(truckId: string): Promise<{
  data: { scheduled: number; skipped: number } | null
  error: string | null
}> {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // V3-014 FIX: Validate input parameters
    if (!truckId || typeof truckId !== "string" || truckId.trim().length === 0) {
      return { error: "Invalid truck ID", data: null }
    }

    const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get truck with current mileage
  const { data: truck, error: truckError } = await supabase
    .from("trucks")
    .select("id, truck_number, current_mileage, make, model, year")
    .eq("id", truckId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (truckError || !truck) {
    return { error: truckError?.message || "Truck not found", data: null }
  }

  // V3-013 FIX: Guard parseFloat against NaN
  const currentMileage = (() => {
    const mileage = truck.current_mileage
    if (typeof mileage === "number") {
      return isNaN(mileage) || !isFinite(mileage) ? 0 : mileage
    }
    const parsed = parseFloat(String(mileage || 0))
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
  })()

  // Get last maintenance records for this truck
  const { data: recentMaintenance } = await supabase
    .from("maintenance")
    .select("service_type, scheduled_date, current_mileage, status")
    .eq("truck_id", truckId)
    .eq("company_id", ctx.companyId)
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

  // Get all last completed services for this truck in a single query to avoid N+1
  // V3-007 FIX: Add LIMIT to prevent unbounded queries
  const { data: allLastServices } = await supabase
    .from("maintenance")
    .select("service_type, current_mileage, scheduled_date")
    .eq("truck_id", truckId)
    .eq("company_id", ctx.companyId)
    .eq("status", "completed")
    .in("service_type", Object.keys(maintenanceIntervals))
    .order("scheduled_date", { ascending: false })
    .limit(100)

  // Group by service_type and get most recent for each
  const lastServiceByType: Record<string, { current_mileage: number; scheduled_date: string }> = {}
  if (allLastServices) {
    for (const service of allLastServices) {
      if (!lastServiceByType[service.service_type]) {
        // V3-013 FIX: Guard parseFloat against NaN
        const mileage = service.current_mileage
        const parsedMileage = typeof mileage === "number" 
          ? (isNaN(mileage) || !isFinite(mileage) ? 0 : mileage)
          : (() => {
              const parsed = parseFloat(String(mileage || 0))
              return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
            })()
        lastServiceByType[service.service_type] = {
          current_mileage: parsedMileage,
          scheduled_date: service.scheduled_date || "",
        }
      }
    }
  }

  // Check each maintenance type
  for (const [serviceType, interval] of Object.entries(maintenanceIntervals)) {
    // Check if this service is already scheduled
    const alreadyScheduled = recentMaintenance?.some(
      (m: any) => m.service_type === serviceType && (m.status === "scheduled" || m.status === "in_progress")
    )

    if (alreadyScheduled) {
      skipped++
      continue
    }

    // Get last service from pre-fetched data
    const lastService = lastServiceByType[serviceType]

    const lastServiceMileage = lastService?.current_mileage || 0
    // V3-013 FIX: Guard against NaN in calculation
    const milesSinceLastService = isFinite(currentMileage) && isFinite(lastServiceMileage)
      ? currentMileage - lastServiceMileage
      : 0

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
  } catch (error: any) {
    console.error("[autoScheduleMaintenanceFromMileage] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
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
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get all active trucks
  // V3-007 FIX: Add LIMIT to prevent unbounded queries
  const { data: trucks, error: trucksError } = await supabase
    .from("trucks")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("status", "active")
    .limit(1000)

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
  } catch (error: any) {
    console.error("[autoScheduleMaintenanceForAllTrucks] Unexpected error:", error)
    return { error: error?.message || "An unexpected error occurred", data: null }
  }
}



