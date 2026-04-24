const REDACTED = "[REDACTED]"

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /cookie/i,
  /session/i,
  /email/i,
  /phone/i,
  /address/i,
  /ssn/i,
  /license/i,
  /credit/i,
  /card/i,
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubValue)
  }
  if (!isPlainObject(value)) {
    return value
  }

  const clone: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = shouldRedactKey(key) ? REDACTED : scrubValue(nestedValue)
  }
  return clone
}

export function scrubSentryEvent<T>(event: T): T {
  if (!event || !isPlainObject(event)) return event
  return scrubValue(event) as T
}
