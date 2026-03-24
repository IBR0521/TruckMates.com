"use server"

/**
 * Driver Gamification and Scoring System
 * Performance scoring, badges, and achievements
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/** `public.driver_badges` — supabase/gamification.sql */
const DRIVER_BADGES_SELECT =
  "id, company_id, driver_id, badge_type, badge_name, badge_description, earned_date, metadata, created_at"

/** `public.driver_performance_scores` — supabase/gamification.sql */
const DRIVER_PERFORMANCE_SCORES_SELECT =
  "id, company_id, driver_id, period_start, period_end, period_type, total_loads, on_time_deliveries, on_time_rate, total_miles, total_driving_hours, idle_time_hours, violations_count, hos_violations, speeding_events, hard_braking, safety_score, compliance_score, efficiency_score, overall_score, rank, created_at, updated_at"

export interface DriverBadge {
  id: string
  driver_id: string
  badge_type: string
  badge_name: string
  badge_description: string | null
  earned_date: string
  metadata: any
}

export interface DriverPerformanceScore {
  id: string
  driver_id: string
  period_start: string
  period_end: string
  period_type: string
  total_loads: number
  on_time_deliveries: number
  on_time_rate: number
  total_miles: number
  total_driving_hours: number
  idle_time_hours: number
  violations_count: number
  hos_violations: number
  speeding_events: number
  hard_braking: number
  safety_score: number
  compliance_score: number
  efficiency_score: number
  overall_score: number
  rank: number | null
  driver?: { name: string }
}

/**
 * Calculate and store driver performance score
 */
export async function calculateDriverPerformanceScore(
  driverId: string,
  periodStart: string,
  periodEnd: string,
  periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly'
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: scoreId, error } = await supabase.rpc('calculate_driver_performance_score', {
      p_driver_id: driverId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_period_type: periodType
    })

    if (error) {
      return { error: error.message || "Failed to calculate performance score", data: null }
    }

    return { data: { score_id: scoreId }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to calculate performance score", data: null }
  }
}

/**
 * Get driver leaderboard
 */
export async function getDriverLeaderboard(
  periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly',
  limit: number = 10
): Promise<{ data: DriverPerformanceScore[] | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get current period
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date = new Date(now)

    if (periodType === 'weekly') {
      periodStart = new Date(now)
      periodStart.setDate(now.getDate() - 7)
    } else if (periodType === 'monthly') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1)
    }

    const { data: scores, error } = await supabase
      .from("driver_performance_scores")
      .select(`
        *,
        drivers:driver_id (id, name)
      `)
      .eq("company_id", ctx.companyId)
      .eq("period_type", periodType)
      .gte("period_end", periodStart.toISOString().split('T')[0])
      .lte("period_start", periodEnd.toISOString().split('T')[0])
      .order("overall_score", { ascending: false })
      .limit(limit)

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: scores || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get leaderboard", data: null }
  }
}

/**
 * Get driver badges
 */
export async function getDriverBadges(driverId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: badges, error } = await supabase
      .from("driver_badges")
      .select(DRIVER_BADGES_SELECT)
      .eq("driver_id", driverId)
      .eq("company_id", ctx.companyId)
      .order("earned_date", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: badges || [], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get driver badges", data: null }
  }
}

/**
 * Check and award badges for a driver
 */
export async function checkAndAwardBadges(
  driverId: string,
  periodStart?: string,
  periodEnd?: string
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const { data: badgesAwarded, error } = await supabase.rpc('check_and_award_badges', {
      p_driver_id: driverId,
      p_period_start: periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      p_period_end: periodEnd || new Date().toISOString().split('T')[0]
    })

    if (error) {
      return { error: error.message || "Failed to check badges", data: null }
    }

    return { data: { badges_awarded: badgesAwarded || 0 }, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to check badges", data: null }
  }
}

/**
 * Get driver performance score
 */
export async function getDriverPerformanceScore(
  driverId: string,
  periodType: 'weekly' | 'monthly' | 'yearly' = 'monthly'
) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get current period
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date = new Date(now)

    if (periodType === 'weekly') {
      periodStart = new Date(now)
      periodStart.setDate(now.getDate() - 7)
    } else if (periodType === 'monthly') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1)
    }

    const { data: score, error } = await supabase
      .from("driver_performance_scores")
      .select(DRIVER_PERFORMANCE_SCORES_SELECT)
      .eq("driver_id", driverId)
      .eq("company_id", ctx.companyId)
      .eq("period_type", periodType)
      .gte("period_end", periodStart.toISOString().split('T')[0])
      .lte("period_start", periodEnd.toISOString().split('T')[0])
      .order("overall_score", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      return { error: error.message, data: null }
    }

    return { data: score || null, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get performance score", data: null }
  }
}

