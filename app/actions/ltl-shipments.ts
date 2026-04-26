"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { sanitizeError, errorMessage } from "@/lib/error-message"
import { checkCreatePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

export async function createShipment(input: {
  shipment_number: string
  shipper_name?: string
  consignee_name?: string
  planned_pickup_date?: string
  planned_delivery_date?: string
  notes?: string
}) {
  const permission = await checkCreatePermission("loads")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      company_id: ctx.companyId,
      shipment_number: input.shipment_number,
      shipper_name: input.shipper_name || null,
      consignee_name: input.consignee_name || null,
      planned_pickup_date: input.planned_pickup_date || null,
      planned_delivery_date: input.planned_delivery_date || null,
      notes: input.notes || null,
    })
    .select("*")
    .single()

  if (error) return { error: safeDbError(error), data: null }
  revalidatePath("/dashboard/dispatches/ltl")
  return { data, error: null }
}

export async function getShipments(filters?: { status?: string }) {
  const permission = await checkViewPermission("loads")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  let query = supabase
    .from("shipments")
    .select("id, shipment_number, status, shipper_name, consignee_name, total_weight_lbs, total_cube_ft, total_pieces, created_at")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (filters?.status) query = query.eq("status", filters.status)
  const { data, error } = await query
  if (error) return { error: safeDbError(error), data: null }
  return { data: data || [], error: null }
}

export async function createTruckMovement(input: {
  movement_number: string
  movement_date?: string
  truck_id?: string
  trailer_id?: string
  driver_id?: string
  terminal_id?: string
  max_weight_lbs?: number
  max_cube_ft?: number
  notes?: string
}) {
  const permission = await checkCreatePermission("dispatch")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("truck_movements")
    .insert({
      company_id: ctx.companyId,
      movement_number: input.movement_number,
      movement_date: input.movement_date || null,
      truck_id: input.truck_id || null,
      trailer_id: input.trailer_id || null,
      driver_id: input.driver_id || null,
      terminal_id: input.terminal_id || null,
      max_weight_lbs: input.max_weight_lbs ?? 45000,
      max_cube_ft: input.max_cube_ft ?? 3800,
      notes: input.notes || null,
    })
    .select("*")
    .single()

  if (error) return { error: safeDbError(error), data: null }
  revalidatePath("/dashboard/dispatches/ltl")
  return { data, error: null }
}

export async function getTruckMovements() {
  const permission = await checkViewPermission("dispatch")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("truck_movements")
    .select("id, movement_number, status, movement_date, max_weight_lbs, max_cube_ft, truck_id, trailer_id, driver_id, created_at")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { error: safeDbError(error), data: null }
  return { data: data || [], error: null }
}

export async function attachShipmentToMovement(input: {
  movement_id: string
  shipment_id: string
  sequence_no?: number
}) {
  const permission = await checkEditPermission("dispatch")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  try {
    const [{ data: movement, error: movementError }, { data: shipment, error: shipmentError }] = await Promise.all([
      supabase
        .from("truck_movements")
        .select("id, company_id, max_weight_lbs, max_cube_ft")
        .eq("id", input.movement_id)
        .eq("company_id", ctx.companyId)
        .maybeSingle(),
      supabase
        .from("shipments")
        .select("id, company_id, total_weight_lbs, total_cube_ft")
        .eq("id", input.shipment_id)
        .eq("company_id", ctx.companyId)
        .maybeSingle(),
    ])
    if (movementError || !movement) return { error: "Movement not found", data: null }
    if (shipmentError || !shipment) return { error: "Shipment not found", data: null }

    const { data: attached } = await supabase
      .from("movement_shipments")
      .select("shipment_id, shipments:shipment_id(total_weight_lbs,total_cube_ft)")
      .eq("company_id", ctx.companyId)
      .eq("movement_id", input.movement_id)

    const usedWeight = (attached || []).reduce((sum: number, row: any) => sum + Number(row.shipments?.total_weight_lbs || 0), 0)
    const usedCube = (attached || []).reduce((sum: number, row: any) => sum + Number(row.shipments?.total_cube_ft || 0), 0)
    const incomingWeight = Number(shipment.total_weight_lbs || 0)
    const incomingCube = Number(shipment.total_cube_ft || 0)

    if (usedWeight + incomingWeight > Number(movement.max_weight_lbs || 0)) {
      return { error: "Cannot attach shipment: movement weight capacity exceeded", data: null }
    }
    if (usedCube + incomingCube > Number(movement.max_cube_ft || 0)) {
      return { error: "Cannot attach shipment: movement cube capacity exceeded", data: null }
    }

    const { data, error } = await supabase
      .from("movement_shipments")
      .insert({
        company_id: ctx.companyId,
        movement_id: input.movement_id,
        shipment_id: input.shipment_id,
        sequence_no: input.sequence_no ?? null,
      })
      .select("*")
      .single()
    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/dispatches/ltl")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to attach shipment"), data: null }
  }
}

export async function getMovementShipments(movementId: string) {
  const permission = await checkViewPermission("dispatch")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("movement_shipments")
    .select("id, sequence_no, shipments:shipment_id(id, shipment_number, shipper_name, consignee_name, total_weight_lbs, total_cube_ft, total_pieces)")
    .eq("company_id", ctx.companyId)
    .eq("movement_id", movementId)
    .order("sequence_no", { ascending: true, nullsFirst: false })

  if (error) return { error: safeDbError(error), data: null }
  return { data: data || [], error: null }
}
