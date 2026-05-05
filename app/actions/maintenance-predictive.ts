"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkCreatePermission, checkViewPermission } from "@/lib/server-permissions"
import { createMaintenance } from "./maintenance"
import { sanitizeError } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


async function ensurePredictiveMaintenanceAccess() {
  return {
    allowed: true as const,
    error: null,
  }
}

/**
 * Predict maintenance needs based on truck usage, mileage, and maintenance history
 */
export async function predictMaintenanceNeeds(truckId?: string) {
  const viewPermission = await checkViewPermission("maintenance")
  if (!viewPermission.allowed) {
    return { error: viewPermission.error || "You don't have permission to view maintenance", data: null }
  }

  const access = await ensurePredictiveMaintenanceAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Build query
  let query = supabase
    .from("trucks")
    .select(`
      id,
      truck_number,
      make,
      model,
      mileage
    `)
    .eq("company_id", ctx.companyId)
    .eq("status", "active")

  if (truckId) {
    query = query.eq("id", truckId)
  }

  const { data: trucks, error } = await query

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  if (!trucks || trucks.length === 0) {
    return { data: [], error: null }
  }

  const truckIds = trucks.map((t: { id: string; [key: string]: any }) => t.id)

  // Primary source requested by product spec: maintenance_records + eld_logs.
  // If maintenance_records table is absent in some environments, fall back to maintenance.
  const { data: maintenanceRecords, error: maintenanceRecordsError } = await supabase
    .from("maintenance_records")
    .select("truck_id, service_type, mileage, service_date, completed_date, created_at")
    .in("truck_id", truckIds)
    .order("service_date", { ascending: false })
    .limit(5000)

  const { data: maintenanceFallback } = maintenanceRecordsError
    ? await supabase
        .from("maintenance")
        .select("truck_id, service_type, mileage, completed_date, scheduled_date, created_at")
        .in("truck_id", truckIds)
        .eq("status", "completed")
        .order("completed_date", { ascending: false })
        .limit(5000)
    : { data: null }

  const records = (maintenanceRecordsError ? maintenanceFallback : maintenanceRecords) || []

  const { data: eldLogs } = await supabase
    .from("eld_logs")
    .select("truck_id, miles_driven, odometer_end, end_time, start_time")
    .in("truck_id", truckIds)
    .order("start_time", { ascending: false })
    .limit(15000)

  const predictions = trucks.map((truck: { id: string; truck_number: string; make: string | null; model: string | null; mileage: number | null; [key: string]: any }) => {
    const truckRecords = records.filter((r: any) => r.truck_id === truck.id)
    const truckLogs = (eldLogs || []).filter((l: any) => l.truck_id === truck.id)
    const currentMileage = Number(truck.mileage || 0)

    const groupedByService = new Map<string, Array<{ mileage: number; date: string | null }>>()
    for (const record of truckRecords) {
      const serviceType = String(record.service_type || "General Service").trim() || "General Service"
      const mileage = Number(record.mileage || 0)
      const serviceDate = String(record.service_date || record.completed_date || record.scheduled_date || record.created_at || "")
      if (!groupedByService.has(serviceType)) groupedByService.set(serviceType, [])
      groupedByService.get(serviceType)?.push({
        mileage,
        date: serviceDate || null,
      })
    }

    const needs: Array<{
      type: string
      priority: "high" | "medium" | "low"
      reason: string
      estimated_mileage: number
    }> = []

    let milesSinceLastMaintenance = 0
    let lastMaintenanceDate: string | null = null

    for (const [serviceType, entries] of groupedByService.entries()) {
      const sortedByMileage = [...entries]
        .filter((e) => Number.isFinite(e.mileage) && e.mileage > 0)
        .sort((a, b) => a.mileage - b.mileage)
      const latest = sortedByMileage[sortedByMileage.length - 1]
      if (!latest) continue

      const intervals: number[] = []
      for (let i = 1; i < sortedByMileage.length; i += 1) {
        const diff = sortedByMileage[i].mileage - sortedByMileage[i - 1].mileage
        if (diff > 0) intervals.push(diff)
      }

      let avgInterval = intervals.length
        ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
        : 0

      if (!avgInterval || !Number.isFinite(avgInterval)) {
        const recentMiles = truckLogs
          .map((l: any) => Number(l.miles_driven || 0))
          .filter((v: number) => Number.isFinite(v) && v > 0)
        if (recentMiles.length > 0) {
          avgInterval = recentMiles.reduce((sum: number, value: number) => sum + value, 0)
        }
      }

      if (!avgInterval || avgInterval <= 0) continue

      const dueMileage = latest.mileage + avgInterval
      const thresholdMileage = dueMileage - avgInterval * 0.1
      const overdue = currentMileage >= dueMileage
      const nearDue = !overdue && currentMileage >= thresholdMileage
      if (!overdue && !nearDue) continue

      const milesRemaining = Math.max(0, Math.round(dueMileage - currentMileage))
      needs.push({
        type: serviceType,
        priority: overdue ? "high" : "medium",
        reason: overdue
          ? `Overdue by ${Math.round(currentMileage - dueMileage).toLocaleString()} miles. Avg interval ${Math.round(avgInterval).toLocaleString()} miles.`
          : `Due soon (~${milesRemaining.toLocaleString()} miles remaining). Avg interval ${Math.round(avgInterval).toLocaleString()} miles.`,
        estimated_mileage: Math.round(dueMileage),
      })

      if (latest.date) {
        if (!lastMaintenanceDate || new Date(latest.date).getTime() > new Date(lastMaintenanceDate).getTime()) {
          lastMaintenanceDate = latest.date
          milesSinceLastMaintenance = Math.max(0, Math.round(currentMileage - latest.mileage))
        }
      }
    }

    return {
      truck_id: truck.id,
      truck_number: truck.truck_number,
      make: truck.make,
      model: truck.model,
      current_mileage: currentMileage,
      miles_since_last_maintenance: milesSinceLastMaintenance,
      last_maintenance_date: lastMaintenanceDate,
      predicted_needs: needs,
      priority: needs.some((n) => n.priority === "high") ? "high" : needs.length > 0 ? "medium" : "low",
    }
  })

  // Sort by priority
  predictions.sort((a: { priority: string; [key: string]: any }, b: { priority: string; [key: string]: any }) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
  })

  return { data: predictions, error: null }
}

/**
 * Create maintenance record from prediction
 */
export async function createMaintenanceFromPrediction(data: {
  truck_id: string
  service_type: string
  estimated_cost?: number
  notes?: string
}) {
  const access = await ensurePredictiveMaintenanceAccess()
  if (!access.allowed) {
    return { error: access.error, data: null }
  }

  const permissionCheck = await checkCreatePermission("maintenance")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to create maintenance records", data: null }
  }

  const today = new Date().toISOString().split("T")[0]
  const result = await createMaintenance({
    truck_id: data.truck_id,
    service_type: data.service_type,
    scheduled_date: today,
    estimated_cost: data.estimated_cost || 0,
    notes: data.notes || `Created from predictive maintenance: ${data.service_type}`,
  })

  if (result.error) {
    return { error: result.error, data: null }
  }

  revalidatePath("/dashboard/maintenance")
  revalidatePath("/dashboard/maintenance/predictive")
  return { data: result.data, error: null }
}












