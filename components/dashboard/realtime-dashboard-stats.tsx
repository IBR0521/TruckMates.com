"use client"

import { useEffect, useState } from "react"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { getDashboardStats } from "@/app/actions/dashboard"
import { toast } from "sonner"

/**
 * Component that provides real-time updates to dashboard stats
 * Uses Supabase Realtime to listen for changes
 */
export function useRealtimeDashboardStats() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initial load
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const result = await getDashboardStats()
      if (result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error("Failed to load dashboard stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Real-time subscription for loads
  useRealtimeSubscription("loads", {
    event: "*",
    onInsert: () => {
      // Reload stats when new load is created
      loadStats()
    },
    onUpdate: () => {
      // Reload stats when load is updated
      loadStats()
    },
    onDelete: () => {
      // Reload stats when load is deleted
      loadStats()
    },
  })

  // Real-time subscription for routes
  useRealtimeSubscription("routes", {
    event: "*",
    onInsert: () => loadStats(),
    onUpdate: () => loadStats(),
    onDelete: () => loadStats(),
  })

  // Real-time subscription for drivers
  useRealtimeSubscription("drivers", {
    event: "*",
    onInsert: () => loadStats(),
    onUpdate: () => loadStats(),
    onDelete: () => loadStats(),
  })

  // Real-time subscription for trucks
  useRealtimeSubscription("trucks", {
    event: "*",
    onInsert: () => loadStats(),
    onUpdate: () => loadStats(),
    onDelete: () => loadStats(),
  })

  return { stats, isLoading, refetch: loadStats }
}

