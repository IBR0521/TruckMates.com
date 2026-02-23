/**
 * React Query hook for dashboard stats
 * Provides caching, deduplication, and automatic refetching
 * OPTIMIZED: Increased stale time and removed aggressive refetching
 */

import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/app/actions/dashboard"

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const result = await getDashboardStats()
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 minutes (increased from 60s)
    gcTime: 10 * 60 * 1000, // 10 minutes - cache persists longer
    retry: 1,
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchInterval: false, // Disable automatic refetching - rely on real-time subscriptions instead
  })
}
