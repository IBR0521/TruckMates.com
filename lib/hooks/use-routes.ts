/**
 * React Query hook for routes
 * Provides caching, deduplication, and pagination
 */

import { useQuery } from "@tanstack/react-query"
import { getRoutes } from "@/app/actions/routes"

interface UseRoutesOptions {
  status?: string
  limit?: number
  enabled?: boolean
}

export function useRoutes(options: UseRoutesOptions = {}) {
  const { status, limit = 25, enabled = true } = options

  return useQuery({
    queryKey: ["routes", { status, limit }],
    queryFn: async () => {
      const result = await getRoutes({ status, limit })
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








