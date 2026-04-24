/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting for API routes and server actions
 * Uses in-memory store for development, Upstash Redis for production
 * 
 * ⚠️ IMPORTANT: In-memory rate limiting resets on every serverless cold start
 * 
 * In Vercel serverless environments, each function invocation can start a fresh instance,
 * meaning the rate limit counter resets constantly and provides essentially no protection
 * in production. This is only a real problem if your API routes are being abused.
 * 
 * EXT-014 FIX: For production-grade rate limiting, use Upstash Redis (free tier available).
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (e.g. in Vercel env); the
 * implementation below activates automatically. Packages: @upstash/ratelimit @upstash/redis
 *
 * See: https://upstash.com/docs/redis/overall/getstarted
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
// ⚠️ WARNING: This resets on every serverless cold start in production
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

  // BUG-003 FIX: Try to use Upstash Redis if configured (for production)
  // In-memory store resets on every serverless cold start, providing no protection
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
    
    if (redisUrl && redisToken) {
      const { Ratelimit } = await import(/* webpackIgnore: true */ "@upstash/ratelimit")
      const { Redis } = await import(/* webpackIgnore: true */ "@upstash/redis")
      
      const redis = new Redis({ url: redisUrl, token: redisToken })
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${window} s`),
      })
      
      const result = await ratelimit.limit(identifier)
      return {
        success: result.success,
        limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    }
  } catch (error) {
    // If Upstash is not configured or fails, fall back to in-memory
    // BUG-003: Log warning in production that rate limiting is ineffective
    if (process.env.NODE_ENV === 'production') {
      console.warn('[RATE_LIMIT] Upstash Redis not configured - using in-memory store (resets on cold start, no protection)')
    }
  }

  // Fallback to in-memory store (BUG-003: Ineffective in serverless production)
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
  
  // On Vercel, this reflects the real client IP determined by the edge.
  const vercelForwarded = headers.get("x-vercel-forwarded-for")
  if (vercelForwarded) {
    return vercelForwarded.split(",")[0].trim()
  }

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

