/**
 * API Cache Utilities
 * Non-server utility functions for API protection
 */

/**
 * Generate cache key for API calls
 */
export function generateCacheKey(
  apiName: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join("|")
  return `${apiName}:${sortedParams}`
}





