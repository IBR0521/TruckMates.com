"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

// Generate AI-powered insights based on ELD data
export async function generateELDInsights(driverId?: string, days: number = 7) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get logs
  let logsQuery = supabase
    .from("eld_logs")
    .select(`
      *,
      drivers:driver_id (id, name),
      trucks:truck_id (id, truck_number)
    `)
    .eq("company_id", userData.company_id)
    .gte("log_date", startDate)

  if (driverId) {
    logsQuery = logsQuery.eq("driver_id", driverId)
  }

  const { data: logs, error: logsError } = await logsQuery

  if (logsError) {
    return { error: logsError.message, data: null }
  }

  // Get violations
  let violationsQuery = supabase
    .from("eld_events")
    .select(`
      *,
      drivers:driver_id (id, name)
    `)
    .eq("company_id", userData.company_id)
    .gte("event_time", startDate)

  if (driverId) {
    violationsQuery = violationsQuery.eq("driver_id", driverId)
  }

  const { data: violations, error: violationsError } = await violationsQuery

  if (violationsError) {
    return { error: violationsError.message, data: null }
  }

  // Analyze patterns and generate insights
  const insights: any[] = []

  // 1. Violation trends
  const violationCounts: Record<string, number> = {}
  violations?.forEach((v) => {
    const date = new Date(v.event_time).toISOString().split('T')[0]
    violationCounts[date] = (violationCounts[date] || 0) + 1
  })

  const violationTrend = Object.values(violationCounts)
  if (violationTrend.length > 1) {
    const recent = violationTrend.slice(-3).reduce((a, b) => a + b, 0) / 3
    const earlier = violationTrend.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, violationTrend.length - 3)
    
    if (recent > earlier * 1.3) {
      insights.push({
        type: "warning",
        title: "Violations Increasing",
        description: `Violations have increased ${Math.round(((recent - earlier) / earlier) * 100)}% in the last 3 days. Consider reviewing driver schedules and routes.`,
        severity: "warning",
        action: "Review driver schedules and provide additional training if needed.",
      })
    } else if (recent < earlier * 0.7) {
      insights.push({
        type: "success",
        title: "Violations Decreasing",
        description: `Great news! Violations have decreased ${Math.round(((earlier - recent) / earlier) * 100)}% in the last 3 days.`,
        severity: "info",
        action: "Keep up the good work! Consider recognizing top performers.",
      })
    }
  }

  // 2. Driver performance comparison
  if (!driverId) {
    const driverViolations: Record<string, number> = {}
    violations?.forEach((v) => {
      const driverName = v.drivers?.name || "Unknown"
      driverViolations[driverName] = (driverViolations[driverName] || 0) + 1
    })

    const sortedDrivers = Object.entries(driverViolations).sort((a, b) => b[1] - a[1])
    if (sortedDrivers.length > 0 && sortedDrivers[0][1] > 3) {
      insights.push({
        type: "warning",
        title: "Driver Needs Attention",
        description: `${sortedDrivers[0][0]} has ${sortedDrivers[0][1]} violations in the last ${days} days, the highest in the fleet.`,
        severity: "warning",
        action: "Schedule a review meeting and provide additional training.",
      })
    }

    // Top performer
    const topPerformer = sortedDrivers[sortedDrivers.length - 1]
    if (topPerformer && topPerformer[1] === 0 && sortedDrivers.length > 1) {
      insights.push({
        type: "success",
        title: "Top Performer",
        description: `${topPerformer[0]} has zero violations in the last ${days} days. Excellent performance!`,
        severity: "info",
        action: "Consider recognizing this driver for their excellent safety record.",
      })
    }
  }

  // 3. Route efficiency
  const routeMiles: Record<string, number> = {}
  logs?.forEach((log) => {
    if (log.log_type === "driving" && log.miles_driven) {
      const routeKey = `${log.location_start?.address || "Unknown"} → ${log.location_end?.address || "Unknown"}`
      routeMiles[routeKey] = (routeMiles[routeKey] || 0) + Number(log.miles_driven)
    }
  })

  // 4. Time-based patterns
  const hourViolations: Record<number, number> = {}
  violations?.forEach((v) => {
    const hour = new Date(v.event_time).getHours()
    hourViolations[hour] = (hourViolations[hour] || 0) + 1
  })

  const peakViolationHour = Object.entries(hourViolations).sort((a, b) => b[1] - a[1])[0]
  if (peakViolationHour && peakViolationHour[1] > 2) {
    insights.push({
      type: "info",
      title: "Peak Violation Time",
      description: `Most violations occur around ${peakViolationHour[0]}:00. This might indicate fatigue or scheduling issues.`,
      severity: "info",
      action: "Consider adjusting schedules or adding break reminders during this time.",
    })
  }

  // 5. Compliance score trend
  const totalViolations = violations?.length || 0
  const totalDrivers = new Set(logs?.map((l) => l.driver_id).filter(Boolean)).size || 1
  const avgViolationsPerDriver = totalViolations / totalDrivers

  if (avgViolationsPerDriver > 2) {
    insights.push({
      type: "critical",
      title: "High Violation Rate",
      description: `Average of ${avgViolationsPerDriver.toFixed(1)} violations per driver in the last ${days} days. This exceeds recommended thresholds.`,
      severity: "critical",
      action: "Immediate action required: Review fleet-wide policies and consider mandatory training.",
    })
  } else if (avgViolationsPerDriver < 0.5) {
    insights.push({
      type: "success",
      title: "Excellent Compliance",
      description: `Fleet-wide compliance is excellent with only ${avgViolationsPerDriver.toFixed(1)} violations per driver on average.`,
      severity: "info",
      action: "Maintain current practices and consider sharing best practices across the fleet.",
    })
  }

  // 6. Efficiency insights
  const totalMiles = logs
    ?.filter((l) => l.log_type === "driving")
    .reduce((sum, l) => sum + (Number(l.miles_driven) || 0), 0) || 0

  const totalDrivingHours = logs
    ?.filter((l) => l.log_type === "driving")
    .reduce((sum, l) => sum + (l.duration_minutes || 0) / 60, 0) || 0

  const avgSpeed = totalDrivingHours > 0 ? totalMiles / totalDrivingHours : 0

  if (avgSpeed > 0) {
    insights.push({
      type: "info",
      title: "Fleet Efficiency",
      description: `Average fleet speed: ${avgSpeed.toFixed(1)} mph. Total miles: ${totalMiles.toFixed(0)} miles in ${totalDrivingHours.toFixed(1)} hours.`,
      severity: "info",
      action: avgSpeed < 45 ? "Consider route optimization to improve efficiency." : "Fleet efficiency looks good!",
    })
  }

  return {
    data: {
      insights,
      summary: {
        totalViolations,
        totalDrivers,
        avgViolationsPerDriver: parseFloat(avgViolationsPerDriver.toFixed(2)),
        totalMiles: parseFloat(totalMiles.toFixed(0)),
        totalDrivingHours: parseFloat(totalDrivingHours.toFixed(1)),
        period: { days, startDate },
      },
    },
    error: null,
  }
}

// Get recommendations for a specific driver
export async function getDriverRecommendations(driverId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get driver's recent violations
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: violations, error: violationsError } = await supabase
    .from("eld_events")
    .select("*")
    .eq("driver_id", driverId)
    .eq("company_id", userData.company_id)
    .gte("event_time", thirtyDaysAgo)
    .order("event_time", { ascending: false })

  if (violationsError) {
    return { error: violationsError.message, data: null }
  }

  const recommendations: any[] = []

  // Analyze violation types
  const violationTypes: Record<string, number> = {}
  violations?.forEach((v) => {
    violationTypes[v.event_type] = (violationTypes[v.event_type] || 0) + 1
  })

  // HOS violations
  if (violationTypes.hos_violation && violationTypes.hos_violation > 2) {
    recommendations.push({
      type: "training",
      title: "HOS Training Recommended",
      description: `Driver has ${violationTypes.hos_violation} HOS violations in the last 30 days.`,
      action: "Schedule HOS compliance training to help driver understand regulations better.",
      priority: "high",
    })
  }

  // Speeding
  if (violationTypes.speeding && violationTypes.speeding > 3) {
    recommendations.push({
      type: "safety",
      title: "Speed Management Training",
      description: `Driver has ${violationTypes.speeding} speeding events.`,
      action: "Provide speed management training and review route planning to avoid time pressure.",
      priority: "medium",
    })
  }

  // Hard braking
  if (violationTypes.hard_brake && violationTypes.hard_brake > 5) {
    recommendations.push({
      type: "safety",
      title: "Defensive Driving Course",
      description: `Driver has ${violationTypes.hard_brake} hard braking events, indicating aggressive driving.`,
      action: "Enroll driver in defensive driving course to improve safety.",
      priority: "high",
    })
  }

  // Positive reinforcement
  if (violations?.length === 0) {
    recommendations.push({
      type: "recognition",
      title: "Excellent Performance",
      description: "Driver has zero violations in the last 30 days!",
      action: "Consider recognizing this driver for their excellent safety record.",
      priority: "low",
    })
  }

  return {
    data: {
      driverId,
      recommendations,
      violationSummary: violationTypes,
      totalViolations: violations?.length || 0,
    },
    error: null,
  }
}

/**
 * Calculate driver behavior score (0-100)
 * Higher score = better performance
 */
export async function getDriverBehaviorScore(driverId: string, days: number = 30) {
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

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Get violations
    const { data: violations, error: violationsError } = await supabase
      .from("eld_events")
      .select("*")
      .eq("driver_id", driverId)
      .eq("company_id", company_id)
      .gte("event_time", startDate)

    if (violationsError) {
      return { error: violationsError.message, data: null }
    }

    // Get logs for driving time
    const { data: logs, error: logsError } = await supabase
      .from("eld_logs")
      .select("*")
      .eq("driver_id", driverId)
      .eq("company_id", company_id)
      .gte("log_date", startDate.split("T")[0])

    if (logsError) {
      return { error: logsError.message, data: null }
    }

    // Calculate score components
    const totalViolations = violations?.length || 0
    const totalDrivingHours = logs
      ?.filter((l) => l.log_type === "driving")
      .reduce((sum, l) => sum + (l.duration_minutes || 0) / 60, 0) || 0

    // Violation score (0-50 points)
    // Fewer violations = higher score
    const violationsPer100Hours = totalDrivingHours > 0 ? (totalViolations / totalDrivingHours) * 100 : totalViolations
    let violationScore = 50
    if (violationsPer100Hours > 5) {
      violationScore = 0
    } else if (violationsPer100Hours > 3) {
      violationScore = 10
    } else if (violationsPer100Hours > 2) {
      violationScore = 20
    } else if (violationsPer100Hours > 1) {
      violationScore = 30
    } else if (violationsPer100Hours > 0.5) {
      violationScore = 40
    } else if (violationsPer100Hours === 0) {
      violationScore = 50
    }

    // Compliance score (0-30 points)
    // Based on HOS compliance
    const hosViolations = violations?.filter((v) => v.event_type === "hos_violation").length || 0
    const complianceScore = hosViolations === 0 ? 30 : Math.max(0, 30 - (hosViolations * 5))

    // Safety score (0-20 points)
    // Based on safety-related violations
    const safetyViolations = violations?.filter((v) => 
      v.event_type === "hard_brake" || v.event_type === "speeding"
    ).length || 0
    const safetyScore = safetyViolations === 0 ? 20 : Math.max(0, 20 - (safetyViolations * 2))

    // Total score
    const totalScore = Math.round(violationScore + complianceScore + safetyScore)
    const scoreGrade = totalScore >= 90 ? "Excellent" : totalScore >= 75 ? "Good" : totalScore >= 60 ? "Fair" : "Needs Improvement"

    // Calculate trend (compare to previous period)
    const previousStartDate = new Date(Date.now() - (days * 2) * 24 * 60 * 60 * 1000).toISOString()
    const { data: previousViolations } = await supabase
      .from("eld_events")
      .select("*")
      .eq("driver_id", driverId)
      .eq("company_id", company_id)
      .gte("event_time", previousStartDate)
      .lt("event_time", startDate)

    const previousTotalViolations = previousViolations?.length || 0
    const trend = previousTotalViolations > 0
      ? ((previousTotalViolations - totalViolations) / previousTotalViolations) * 100
      : totalViolations === 0 ? 100 : 0

    return {
      data: {
        driver_id: driverId,
        score: totalScore,
        grade: scoreGrade,
        breakdown: {
          violation_score: violationScore,
          compliance_score: complianceScore,
          safety_score: safetyScore,
        },
        metrics: {
          total_violations: totalViolations,
          violations_per_100_hours: Math.round(violationsPer100Hours * 10) / 10,
          total_driving_hours: Math.round(totalDrivingHours * 10) / 10,
          hos_violations: hosViolations,
          safety_violations: safetyViolations,
        },
        trend: Math.round(trend * 10) / 10,
        period_days: days,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to calculate behavior score", data: null }
  }
}

/**
 * Get behavior scores for all drivers
 */
export async function getAllDriverBehaviorScores(days: number = 30) {
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
    // Get all drivers
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name")
      .eq("company_id", company_id)
      .eq("status", "active")

    if (driversError) {
      return { error: driversError.message, data: null }
    }

    // Calculate scores for each driver
    const scores = await Promise.all(
      (drivers || []).map(async (driver) => {
        const scoreResult = await getDriverBehaviorScore(driver.id, days)
        if (scoreResult.data) {
          return {
            driver_id: driver.id,
            driver_name: driver.name,
            ...scoreResult.data,
          }
        }
        return null
      })
    )

    const validScores = scores.filter((s) => s !== null)

    // Sort by score (highest first)
    validScores.sort((a: any, b: any) => b.score - a.score)

    return {
      data: {
        scores: validScores,
        average_score: validScores.length > 0
          ? Math.round(validScores.reduce((sum: number, s: any) => sum + s.score, 0) / validScores.length)
          : 0,
        total_drivers: validScores.length,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get driver behavior scores", data: null }
  }
}
