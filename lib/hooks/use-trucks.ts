/**
 * React Query hook for trucks
 * Provides caching, deduplication, and pagination
 */

import { useQuery } from "@tanstack/react-query"
import { getTrucks } from "@/app/actions/trucks"

interface UseTrucksOptions {
  status?: string
  limit?: number
  enabled?: boolean
}

export function useTrucks(options: UseTrucksOptions = {}) {
  const { status, limit = 25, enabled = true } = options

  return useQuery({
    queryKey: ["trucks", { status, limit }],
    queryFn: async () => {
      const result = await getTrucks({ status, limit })
      if (result.error) {
        throw new Error(result.error)
      }
      return result
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  })
}







