"use server"

/**
 * Idle Time Tracking
 * Track and report idle time using GPS and engine status data
 */

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export interface IdleTimeSession {
  id: string
  truck_id: string
  driver_id: string | null
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  location_latitude: number | null
  location_longitude: number | null
  idle_type: string
  engine_status: string
  speed: number
  estimated_fuel_gallons: number | null
  estimated_fuel_cost: number | null
  truck?: { truck_number: string; make: string; model: string }
  driver?: { name: string }
}

/**
 * Detect and record idle time from location update
 */
export async function detectIdleTime(
  truckId: string,
  latitude: number,
  longitude: number,
  timestamp: string,
  speed?: number,
  engineStatus?: string,
  driverId?: string
) {
  const supabase = await createClient()

  try {
    const { data: sessionId, error } = await supabase.rpc('detect_idle_time', {
      p_truck_id: truckId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_timestamp: timestamp,
      p_speed: speed || 0,
      p_engine_status: engineStatus || 'unknown',
      p_driver_id: driverId || null
    })

    if (error) {
      Sentry.captureException(error)
      return { error: safeDbError(error), data: null }
    }

    // If session was created/updated, calculate fuel cost
    if (sessionId) {
      await supabase.rpc('calculate_idle_fuel_cost', {
        p_session_id: sessionId
      })
    }

    return { data: { session_id: sessionId }, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to detect idle time"), data: null }
  }
}

/**
 * Get idle time sessions
 */
export async function getIdleTimeSessions(filters?: {
  truck_id?: string
  driver_id?: string
  start_date?: string
  end_date?: string
  min_duration_minutes?: number
  limit?: number
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    let query = supabase
      .from("idle_time_sessions")
      .select(`
        *,
        trucks:truck_id (id, truck_number, make, model),
        drivers:driver_id (id, name)
      `)
      .eq("company_id", ctx.companyId)
      .order("start_time", { ascending: false })

    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.start_date) {
      query = query.gte("start_time", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("start_time", filters.end_date)
    }
    if (filters?.min_duration_minutes) {
      query = query.gte("duration_minutes", filters.min_duration_minutes)
    }

    const limit = filters?.limit || 100
    query = query.limit(limit)

    const { data: sessions, error } = await query

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: sessions || [], error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get idle time sessions"), data: null }
  }
}

/**
 * Get idle time statistics
 */
export async function getIdleTimeStats(filters?: {
  truck_id?: string
  driver_id?: string
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
      .from("idle_time_sessions")
      .select("duration_minutes, estimated_fuel_cost, truck_id, driver_id")
      .eq("company_id", ctx.companyId)

    if (filters?.truck_id) {
      query = query.eq("truck_id", filters.truck_id)
    }
    if (filters?.driver_id) {
      query = query.eq("driver_id", filters.driver_id)
    }
    if (filters?.start_date) {
      query = query.gte("start_time", filters.start_date)
    }
    if (filters?.end_date) {
      query = query.lte("start_time", filters.end_date)
    }

    const { data: sessions, error } = await query

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Calculate statistics
    const totalMinutes = sessions?.reduce((sum: number, s: { duration_minutes: number | null; [key: string]: any }) => sum + (s.duration_minutes || 0), 0) || 0
    const totalHours = totalMinutes / 60
    const totalFuelCost = sessions?.reduce((sum: number, s: { estimated_fuel_cost: number | null; [key: string]: any }) => sum + (s.estimated_fuel_cost || 0), 0) || 0
    const totalSessions = sessions?.length || 0
    const avgDurationMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0

    // Group by truck
    const byTruck: Record<string, { minutes: number; cost: number; sessions: number }> = {}
    sessions?.forEach((s: { truck_id: string | null; duration_minutes: number | null; estimated_fuel_cost: number | null; [key: string]: any }) => {
      if (!s.truck_id) return
      if (!byTruck[s.truck_id]) {
        byTruck[s.truck_id] = { minutes: 0, cost: 0, sessions: 0 }
      }
      byTruck[s.truck_id].minutes += s.duration_minutes || 0
      byTruck[s.truck_id].cost += s.estimated_fuel_cost || 0
      byTruck[s.truck_id].sessions += 1
    })

    // Group by driver
    const byDriver: Record<string, { minutes: number; cost: number; sessions: number }> = {}
    sessions?.forEach((s: { driver_id: string | null; duration_minutes: number | null; estimated_fuel_cost: number | null; [key: string]: any }) => {
      if (!s.driver_id) return
      if (!byDriver[s.driver_id]) {
        byDriver[s.driver_id] = { minutes: 0, cost: 0, sessions: 0 }
      }
      byDriver[s.driver_id].minutes += s.duration_minutes || 0
      byDriver[s.driver_id].cost += s.estimated_fuel_cost || 0
      byDriver[s.driver_id].sessions += 1
    })

    return {
      data: {
        total_minutes: totalMinutes,
        total_hours: totalHours,
        total_fuel_cost: totalFuelCost,
        total_sessions: totalSessions,
        avg_duration_minutes: avgDurationMinutes,
        by_truck: byTruck,
        by_driver: byDriver
      },
      error: null
    }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get idle time stats"), data: null }
  }
}

/**
 * Close idle session (when truck starts moving)
 */
export async function closeIdleSession(sessionId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: session, error: fetchError } = await supabase
      .from("idle_time_sessions")
      .select(
        "id, company_id, truck_id, driver_id, start_time, end_time, duration_minutes, location_latitude, location_longitude, idle_type, engine_status, speed, estimated_fuel_gallons, estimated_fuel_cost, created_at, updated_at",
      )
      .eq("id", sessionId)
      .eq("company_id", ctx.companyId)
      .single()

    if (fetchError || !session) {
      return { error: "Session not found or access denied", data: null }
    }

    const endTime = new Date().toISOString()
    const durationMinutes = Math.round(
      (new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 60000
    )

    const { data, error } = await supabase
      .from("idle_time_sessions")
      .update({
        end_time: endTime,
        duration_minutes: durationMinutes,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .eq("company_id", ctx.companyId)
      .select()
      .single()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    // Recalculate fuel cost
    await supabase.rpc('calculate_idle_fuel_cost', {
      p_session_id: sessionId
    })

    return { data, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to close idle session"), data: null }
  }
}



