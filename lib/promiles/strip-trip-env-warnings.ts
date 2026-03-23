/**
 * Warnings about missing env vars are only valid at calculation time.
 * Persisted JSON on loads would otherwise show stale "HERE_API_KEY not set" forever
 * after keys are added — unless we strip them when saving / hydrating.
 */
const STALE_ENV_WARNING_PREFIXES = [
  "HERE_API_KEY not set",
  "EIA_API_KEY not set",
  "TOLLGURU_API_KEY not set",
] as const

export function stripStaleEnvKeyWarnings<T extends { warnings: string[] }>(
  estimate: T | null | undefined,
): T | null {
  if (!estimate) return null
  if (!estimate.warnings?.length) return estimate
  const warnings = estimate.warnings.filter(
    (w) => !STALE_ENV_WARNING_PREFIXES.some((p) => w.startsWith(p)),
  )
  return { ...estimate, warnings }
}
