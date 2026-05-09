export function isProductionRuntime(): boolean {
  const nodeEnv = process.env.NODE_ENV
  const vercelEnv = process.env.VERCEL_ENV
  return nodeEnv === "production" || vercelEnv === "production"
}

export function isDevSurfaceBlocked(): boolean {
  return isProductionRuntime()
}

