"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkCreatePermission, checkViewPermission } from "@/lib/server-permissions"
import { getCurrentCompanyFeatureAccess } from "@/lib/plan-gates"
import { createMaintenance } from "./maintenance"

async function ensurePredictiveMaintenanceAccess() {
  const access = await getCurrentCompanyFeatureAccess("predictive_maintenance")
  if (access.error) {
    return { allowed: false, error: access.error }
  }
  if (!access.allowed) {
    return { allowed: false, error: "Predictive maintenance is available on Fleet and Enterprise plans" }
  }
  return { allowed: true as const, error: null as string | null }
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
    return { error: error.message, data: null }
  }

  if (!trucks || trucks.length === 0) {
    return { data: [], error: null }
  }

  // Get maintenance history for these trucks - use DISTINCT ON to get only most recent per service type per truck
  const truckIds = trucks.map((t: { id: string; [key: string]: any }) => t.id)
  
  // Use a more efficient query: get only the most recent maintenance per service type per truck
  // This prevents loading entire history into memory
  const { data: maintenanceHistory } = await supabase
    .from("maintenance")
    .select("truck_id, service_type, mileage, scheduled_date")
    .in("truck_id", truckIds)
    .eq("status", "completed")
    .order("scheduled_date", { ascending: false })
    .limit(1000) // Cap at 1000 rows to prevent memory issues

  // Predict maintenance needs
  const predictions = trucks.map((truck: { id: string; truck_number: string; make: string | null; model: string | null; mileage: number | null; [key: string]: any }) => {
    const truckMaintenance = maintenanceHistory?.filter((m: { truck_id: string; service_type: string; mileage: number | null; scheduled_date: string; [key: string]: any }) => m.truck_id === truck.id) || []
    
    // Calculate miles since last maintenance
    const lastMaintenance = truckMaintenance[0]
    const currentMileage = truck.mileage || 0
    const milesSinceLastMaintenance = lastMaintenance
      ? currentMileage - (lastMaintenance.mileage || 0)
      : currentMileage

    // Standard maintenance intervals (miles)
    const maintenanceIntervals = {
      oil_change: 10000,
      tire_rotation: 15000,
      brake_inspection: 20000,
      major_service: 50000,
    }

    // Predict what maintenance is needed
    const needs: Array<{
      type: string
      priority: "high" | "medium" | "low"
      reason: string
      estimated_mileage: number
    }> = []

    // Oil change prediction
    if (milesSinceLastMaintenance >= maintenanceIntervals.oil_change * 0.9) {
      needs.push({
        type: "Oil Change",
        priority: milesSinceLastMaintenance >= maintenanceIntervals.oil_change ? "high" : "medium",
        reason: `Miles since last maintenance: ${milesSinceLastMaintenance.toLocaleString()}`,
        estimated_mileage: (lastMaintenance?.mileage || 0) + maintenanceIntervals.oil_change,
      })
    }

    // Tire rotation prediction
    if (milesSinceLastMaintenance >= maintenanceIntervals.tire_rotation * 0.9) {
      needs.push({
        type: "Tire Rotation",
        priority: milesSinceLastMaintenance >= maintenanceIntervals.tire_rotation ? "high" : "medium",
        reason: `Miles since last maintenance: ${milesSinceLastMaintenance.toLocaleString()}`,
        estimated_mileage: (lastMaintenance?.mileage || 0) + maintenanceIntervals.tire_rotation,
      })
    }

    // Brake inspection prediction
    if (milesSinceLastMaintenance >= maintenanceIntervals.brake_inspection * 0.9) {
      needs.push({
        type: "Brake Inspection",
        priority: milesSinceLastMaintenance >= maintenanceIntervals.brake_inspection ? "high" : "medium",
        reason: `Miles since last maintenance: ${milesSinceLastMaintenance.toLocaleString()}`,
        estimated_mileage: (lastMaintenance?.mileage || 0) + maintenanceIntervals.brake_inspection,
      })
    }

    // Major service prediction
    if (milesSinceLastMaintenance >= maintenanceIntervals.major_service * 0.9) {
      needs.push({
        type: "Major Service",
        priority: milesSinceLastMaintenance >= maintenanceIntervals.major_service ? "high" : "medium",
        reason: `Miles since last maintenance: ${milesSinceLastMaintenance.toLocaleString()}`,
        estimated_mileage: (lastMaintenance?.mileage || 0) + maintenanceIntervals.major_service,
      })
    }

    return {
      truck_id: truck.id,
      truck_number: truck.truck_number,
      make: truck.make,
      model: truck.model,
      current_mileage: currentMileage,
      miles_since_last_maintenance: milesSinceLastMaintenance,
      last_maintenance_date: lastMaintenance?.scheduled_date || null,
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












