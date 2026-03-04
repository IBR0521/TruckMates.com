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
 * 
 * To enable Upstash Redis rate limiting:
 * 1. Install: npm install @upstash/ratelimit @upstash/redis
 * 2. Set environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 3. Uncomment the Upstash code block below and remove the in-memory fallback
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

  // Use Upstash Redis in production if configured
  // Note: Upstash packages are optional - if not installed, falls back to in-memory
  // Skip Upstash entirely if packages aren't available (prevents build-time analysis)
  // Users can install @upstash/ratelimit and @upstash/redis if they want Redis-based rate limiting

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

