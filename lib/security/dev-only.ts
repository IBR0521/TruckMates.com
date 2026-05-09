export function isProductionRuntime(): boolean {
  const nodeEnv = process.env.NODE_ENV
  const vercelEnv = process.env.VERCEL_ENV
  return nodeEnv === "production" || vercelEnv === "production"
}

export function isDevSurfaceBlocked(): boolean {
  return isProductionRuntime()
}

/** Paid or high-risk demo actions (writes outside shared seeding, destructive ops, infra probes). */
export function isExpensiveDemoSurfaceBlocked(): boolean {
  return isProductionRuntime()
}

/** Read-only demo browsing is allowed everywhere, including production. */
export function isDemoBrowsingAllowed(): boolean {
  return true
}

