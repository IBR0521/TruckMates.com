"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Predict maintenance needs based on truck usage, mileage, and maintenance history
 */
export async function predictMaintenanceNeeds(truckId?: string) {
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

  // Build query
  let query = supabase
    .from("trucks")
    .select(`
      id,
      truck_number,
      make,
      model,
      current_mileage,
      last_maintenance_mileage,
      last_maintenance_date
    `)
    .eq("company_id", result.company_id)
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

  // Get maintenance history for these trucks
  const truckIds = trucks.map((t) => t.id)
  const { data: maintenanceHistory } = await supabase
    .from("maintenance")
    .select("truck_id, service_type, mileage, service_date")
    .in("truck_id", truckIds)
    .order("service_date", { ascending: false })

  // Predict maintenance needs
  const predictions = trucks.map((truck) => {
    const truckMaintenance = maintenanceHistory?.filter((m) => m.truck_id === truck.id) || []
    
    // Calculate miles since last maintenance
    const lastMaintenance = truckMaintenance[0]
    const milesSinceLastMaintenance = lastMaintenance
      ? (truck.current_mileage || 0) - (lastMaintenance.mileage || 0)
      : truck.current_mileage || 0

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
      current_mileage: truck.current_mileage || 0,
      miles_since_last_maintenance: milesSinceLastMaintenance,
      last_maintenance_date: lastMaintenance?.service_date || truck.last_maintenance_date,
      predicted_needs: needs,
      priority: needs.some((n) => n.priority === "high") ? "high" : needs.length > 0 ? "medium" : "low",
    }
  })

  // Sort by priority
  predictions.sort((a, b) => {
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

  // Get truck current mileage
  const { data: truck } = await supabase
    .from("trucks")
    .select("current_mileage")
    .eq("id", data.truck_id)
    .single()

  // Create maintenance record
  const { data: maintenance, error } = await supabase
    .from("maintenance")
    .insert({
      company_id: result.company_id,
      truck_id: data.truck_id,
      service_type: data.service_type,
      service_date: new Date().toISOString().split("T")[0],
      mileage: truck?.current_mileage || 0,
      cost: data.estimated_cost || 0,
      notes: data.notes || `Created from predictive maintenance: ${data.service_type}`,
      status: "scheduled",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance")
  revalidatePath("/dashboard/maintenance/predictive")
  return { data: maintenance, error: null }
}

