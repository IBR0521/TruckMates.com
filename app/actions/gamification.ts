"use server"

/**
 * Driver Gamification and Scoring System
 * Performance scoring, badges, and achievements
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
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
      .eq("company_id", company_id)
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
    const { data: badges, error } = await supabase
      .from("driver_badges")
      .select("*")
      .eq("driver_id", driverId)
      .eq("company_id", company_id)
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
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

