/**
 * Simple in-memory cache for server actions
 * Use for frequently accessed, rarely changing data
 * Server-side only - cleanup happens on access
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number = 30000 // 30 seconds default
  private lastCleanup: number = Date.now()
  private cleanupInterval: number = 10 * 60 * 1000 // 10 minutes (less frequent cleanup)

  /**
   * Get cached value (FAST - minimal checks)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Fast expiration check
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Cleanup expired entries periodically (less frequent for speed)
    const now = Date.now()
    if (now - this.lastCleanup > this.cleanupInterval) {
      // Async cleanup to not block
      setImmediate(() => {
        this.cleanup()
        this.lastCleanup = now
      })
    }

    return entry.data as T
  }

  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { data, expiresAt })
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    // Collect keys to delete (avoid modifying map during iteration)
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    })
    
    // Delete expired entries
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

// Singleton instance
export const cache = new SimpleCache()

/**
 * Cache key generators
 */
export const cacheKeys = {
  userCompany: (userId: string) => `user:company:${userId}`,
  dashboardStats: (companyId: string) => `dashboard:stats:${companyId}`,
  load: (loadId: string) => `load:${loadId}`,
  driver: (driverId: string) => `driver:${driverId}`,
  truck: (truckId: string) => `truck:${truckId}`,
  route: (routeId: string) => `route:${routeId}`,
}
