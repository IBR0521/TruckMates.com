/**
 * React Query hook for drivers
 * Provides caching, deduplication, and pagination
 */

import { useQuery } from "@tanstack/react-query"
import { getDrivers } from "@/app/actions/drivers"

interface UseDriversOptions {
  status?: string
  limit?: number
  enabled?: boolean
}

export function useDrivers(options: UseDriversOptions = {}) {
  const { status, limit = 25, enabled = true } = options

  return useQuery({
    queryKey: ["drivers", { status, limit }],
    queryFn: async () => {
      const result = await getDrivers({ status, limit })
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







