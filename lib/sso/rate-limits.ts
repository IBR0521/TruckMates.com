import { rateLimitRedis } from "@/lib/rate-limit-redis"

const LOGIN_LIMIT_PER_DOMAIN = 20
const LOGIN_WINDOW_SECONDS = 60
const ACS_LIMIT_PER_IP = 60
const ACS_WINDOW_SECONDS = 60

export async function checkSsoLoginRateLimit(emailDomain: string) {
  const key = `sso:login:${emailDomain.toLowerCase()}`
  return rateLimitRedis(key, { limit: LOGIN_LIMIT_PER_DOMAIN, window: LOGIN_WINDOW_SECONDS })
}

export async function checkSsoAcsRateLimit(ipAddress: string) {
  const key = `sso:acs:${ipAddress || "unknown"}`
  return rateLimitRedis(key, { limit: ACS_LIMIT_PER_IP, window: ACS_WINDOW_SECONDS })
}
