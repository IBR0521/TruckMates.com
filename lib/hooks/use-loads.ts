/**
 * React Query hook for loads
 * Provides caching, deduplication, and pagination
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query"
import { getLoads } from "@/app/actions/loads"

interface UseLoadsOptions {
  status?: string
  limit?: number
  enabled?: boolean
}

export function useLoads(options: UseLoadsOptions = {}) {
  const { status, limit = 25, enabled = true } = options

  return useQuery({
    queryKey: ["loads", { status, limit }],
    queryFn: async () => {
      const result = await getLoads({ status, limit })
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

export function useInfiniteLoads(options: UseLoadsOptions = {}) {
  const { status, limit = 25, enabled = true } = options

  return useInfiniteQuery({
    queryKey: ["loads", "infinite", { status }],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await getLoads({
        status,
        limit,
        offset: pageParam * limit,
      })
      if (result.error) {
        throw new Error(result.error)
      }
      return {
        data: result.data || [],
        nextOffset: (result.data?.length || 0) < limit ? undefined : pageParam + 1,
      }
    },
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}








