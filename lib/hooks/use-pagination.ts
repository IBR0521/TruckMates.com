/**
 * Reusable pagination hook for data fetching
 * Handles pagination state and loading more data
 */

import { useState, useCallback } from "react"

interface UsePaginationOptions {
  initialLimit?: number
  maxLimit?: number
}

interface UsePaginationReturn<T> {
  data: T[]
  isLoading: boolean
  hasMore: boolean
  totalCount: number
  currentPage: number
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
}

export function usePagination<T>(
  fetchFn: (options: { limit: number; offset: number }) => Promise<{ data: T[] | null; error: string | null; count?: number }>,
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { initialLimit = 25, maxLimit = 100 } = options
  
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [offset, setOffset] = useState(0)

  const loadData = useCallback(async (reset = false) => {
    if (isLoading) return
    
    setIsLoading(true)
    try {
      const currentOffset = reset ? 0 : offset
      const result = await fetchFn({ limit: initialLimit, offset: currentOffset })
      
      if (result.error) {
        console.error("Pagination error:", result.error)
        return
      }
      
      if (result.data) {
        if (reset) {
          setData(result.data)
          setOffset(initialLimit)
          setCurrentPage(1)
        } else {
          setData(prev => [...prev, ...result.data])
          setOffset(prev => prev + initialLimit)
          setCurrentPage(prev => prev + 1)
        }
        
        if (result.count !== undefined) {
          setTotalCount(result.count)
          setHasMore(result.data.length === initialLimit && (currentOffset + initialLimit) < result.count)
        } else {
          // If no count, assume more data if we got a full page
          setHasMore(result.data.length === initialLimit)
        }
      }
    } catch (error) {
      console.error("Pagination fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchFn, initialLimit, offset, isLoading])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    await loadData(false)
  }, [hasMore, isLoading, loadData])

  const refresh = useCallback(async () => {
    await loadData(true)
  }, [loadData])

  const reset = useCallback(() => {
    setData([])
    setOffset(0)
    setCurrentPage(0)
    setHasMore(true)
    setTotalCount(0)
  }, [])

  // Initial load
  useState(() => {
    loadData(true)
  })

  return {
    data,
    isLoading,
    hasMore,
    totalCount,
    currentPage,
    loadMore,
    refresh,
    reset,
  }
}







