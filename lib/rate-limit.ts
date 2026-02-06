/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting for API routes and server actions
 * Uses in-memory store for development, Upstash Redis for production
 */

interface RateLimitOptions {
  limit: number // Number of requests
  window: number // Time window in seconds
  identifier?: string // Custom identifier (defaults to IP)
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp
}

// In-memory store for development
const memoryStore = new Map<string, { count: number; reset: number }>()

// Clean up expired entries every minute
if (typeof global !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of memoryStore.entries()) {
      if (value.reset < now) {
        memoryStore.delete(key)
      }
    }
  }, 60000)
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, window } = options
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const reset = now + window * 1000

  // Use Upstash Redis in production if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // Dynamic import with error handling - packages are optional
      const upstashRatelimit = await import("@upstash/ratelimit").catch(() => null)
      const upstashRedis = await import("@upstash/redis").catch(() => null)
      
      if (!upstashRatelimit || !upstashRedis) {
        throw new Error("Upstash packages not available")
      }
      
      const { Ratelimit } = upstashRatelimit
      const { Redis } = upstashRedis

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })

      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${window} s`),
        analytics: true,
      })

      const result = await ratelimit.limit(identifier)
      
      return {
        success: result.success,
        limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    } catch (error) {
      console.error("Rate limit error (falling back to memory):", error)
      // Fall through to memory store
    }
  }

  // Fallback to in-memory store
  const current = memoryStore.get(key)
  
  if (!current || current.reset < now) {
    memoryStore.set(key, { count: 1, reset })
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.floor(reset / 1000),
    }
  }

  if (current.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.floor(current.reset / 1000),
    }
  }

  current.count++
  return {
    success: true,
    limit,
    remaining: limit - current.count,
    reset: Math.floor(current.reset / 1000),
  }
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request | { headers: Headers }): string {
  const headers = request.headers instanceof Headers ? request.headers : new Headers(Object.entries(request.headers as Record<string, string>))
  
  // Check various headers for IP
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  
  const realIP = headers.get("x-real-ip")
  if (realIP) {
    return realIP
  }
  
  return "unknown"
}

