"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { getDashboardStats } from "@/app/actions/dashboard"
import { toast } from "sonner"

/**
 * Component that provides real-time updates to dashboard stats
 * Uses Supabase Realtime to listen for changes
 * OPTIMIZED: Debounced updates to prevent cascading reloads
 */
export function useRealtimeDashboardStats() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdateRef = useRef(false)

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
      // Only log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to load dashboard stats:", error)
      }
    } finally {
      setIsLoading(false)
      pendingUpdateRef.current = false
    }
  }

  // Debounced stats reload - prevents cascading updates
  const debouncedLoadStats = useCallback(() => {
    // If there's already a pending update, don't schedule another
    if (pendingUpdateRef.current) {
      return
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Mark that we have a pending update
    pendingUpdateRef.current = true

    // Schedule reload after 1 second of inactivity
    debounceTimerRef.current = setTimeout(() => {
      loadStats()
    }, 1000)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Real-time subscription for loads - debounced
  useRealtimeSubscription("loads", {
    event: "*",
    onInsert: debouncedLoadStats,
    onUpdate: debouncedLoadStats,
    onDelete: debouncedLoadStats,
  })

  // Real-time subscription for routes - debounced
  useRealtimeSubscription("routes", {
    event: "*",
    onInsert: debouncedLoadStats,
    onUpdate: debouncedLoadStats,
    onDelete: debouncedLoadStats,
  })

  // Real-time subscription for drivers - debounced
  useRealtimeSubscription("drivers", {
    event: "*",
    onInsert: debouncedLoadStats,
    onUpdate: debouncedLoadStats,
    onDelete: debouncedLoadStats,
  })

  // Real-time subscription for trucks - debounced
  useRealtimeSubscription("trucks", {
    event: "*",
    onInsert: debouncedLoadStats,
    onUpdate: debouncedLoadStats,
    onDelete: debouncedLoadStats,
  })

  return { stats, isLoading, refetch: loadStats }
}

