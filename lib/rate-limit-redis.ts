/**
 * Redis-based Rate Limiting Utility
 * 
 * Production-grade rate limiting using Upstash Redis
 * Falls back to in-memory if Redis is not configured
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

// Try to import Upstash Redis (optional dependency)
let redis: any = null
let Ratelimit: any = null

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for rate limiting.",
  )
}

try {
  // Dynamic import to prevent build errors if package isn't installed
  const upstashRedis = require("@upstash/redis")
  const upstashRatelimit = require("@upstash/ratelimit")
  
  if (upstashRedis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new upstashRedis.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    
    Ratelimit = upstashRatelimit.Ratelimit
  }
} catch (error) {
  // Upstash not installed or not configured - will fall back to in-memory
  console.log("[Rate Limit] Upstash Redis not configured, using in-memory fallback")
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; reset: number }>()

/**
 * Clean up expired entries from memory store
 * Called during rate limit checks (not via setInterval, which doesn't work in serverless)
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, value] of memoryStore.entries()) {
    if (value.reset < now) {
      memoryStore.delete(key)
    }
  }
}

/**
 * Rate limit using Redis (if available) or in-memory fallback
 */
export async function rateLimitRedis(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, window } = options
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const reset = now + window * 1000

  // Use Upstash Redis if configured
  if (redis && Ratelimit) {
    try {
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
      console.error("[Rate Limit] Redis error, falling back to in-memory:", error)
      // Fall through to in-memory
    }
  }

  // Fallback to in-memory store
  // Clean up expired entries before checking (serverless-compatible)
  cleanupExpiredEntries()
  
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
  const headers = request.headers instanceof Headers 
    ? request.headers 
    : new Headers(Object.entries(request.headers as Record<string, string>))
  
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

