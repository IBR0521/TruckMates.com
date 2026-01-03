/**
 * Query optimization utilities
 */

import { createClient } from "@/lib/supabase/server"
import { cache, cacheKeys } from "./cache"

/**
 * Get user company_id with caching (FAST - no retries, just cache)
 * This is called in almost every server action
 */
export async function getCachedUserCompany(userId: string): Promise<{ company_id: string | null; error: string | null }> {
  const cacheKey = cacheKeys.userCompany(userId)
  
  // Check cache first (fast path)
  const cached = cache.get<{ company_id: string | null }>(cacheKey)
  if (cached) {
    return { ...cached, error: null }
  }

  // Fetch from database (no retries - keep it fast)
  const supabase = await createClient()
  const { data: userData, error } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single()

  if (error) {
    return { company_id: null, error: error.message }
  }

  const result = { company_id: userData?.company_id || null }
  
  // Cache for 5 minutes (company_id rarely changes)
  cache.set(cacheKey, result, 5 * 60 * 1000)

  return { ...result, error: null }
}

/**
 * Batch multiple count queries into a single request where possible
 */
export async function batchCountQueries(
  companyId: string,
  queries: Array<{ table: string; filters?: Record<string, any> }>
): Promise<Record<string, number>> {
  const supabase = await createClient()
  const results: Record<string, number> = {}

  // Execute all count queries in parallel
  const promises = queries.map(async (query) => {
    let queryBuilder = supabase
      .from(query.table)
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)

    // Apply filters
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          queryBuilder = queryBuilder.in(key, value)
        } else {
          queryBuilder = queryBuilder.eq(key, value)
        }
      })
    }

    const { count, error } = await queryBuilder
    return { table: query.table, count: count || 0, error }
  })

  const queryResults = await Promise.all(promises)
  
  queryResults.forEach((result) => {
    if (!result.error) {
      results[result.table] = result.count
    }
  })

  return results
}

/**
 * Optimize select queries - only fetch needed columns
 */
export function selectOnly(columns: string[]): string {
  return columns.join(", ")
}

/**
 * Add pagination to queries
 */
export interface PaginationOptions {
  page?: number
  limit?: number
  offset?: number
}

export function applyPagination<T>(
  query: any,
  options: PaginationOptions = {}
): { query: any; pagination: { page: number; limit: number; offset: number } } {
  const page = options.page || 1
  const limit = options.limit || 50
  const offset = options.offset !== undefined ? options.offset : (page - 1) * limit

  return {
    query: query.range(offset, offset + limit - 1),
    pagination: { page, limit, offset },
  }
}

