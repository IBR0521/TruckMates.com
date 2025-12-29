"use client"

import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/app/actions/dashboard"

const STALE_TIME = 30000 // 30 seconds - data is considered fresh for 30s
const CACHE_TIME = 300000 // 5 minutes - cache persists for 5 minutes

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const result = await getDashboardStats()
      if (result.error) {
        throw new Error(result.error)
      }
      if (!result.data) {
        throw new Error("No data returned")
      }
      return result.data
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME, // Previously cacheTime in older versions
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: true, // Refetch when connection is restored
    retry: 1, // Retry once on failure
  })
}
