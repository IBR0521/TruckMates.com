"use server"

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"

/** Auto-optimize a route when company settings allow and the route has multiple stops. */
export async function maybeAutoOptimizeRouteAfterStopChange(
  routeId: string,
  companyId: string,
): Promise<void> {
  const admin = createAdminClient()

  const { data: settings } = await admin
    .from("company_settings")
    .select("auto_optimize_routes, auto_optimize_route")
    .eq("company_id", companyId)
    .maybeSingle()

  if (!settings?.auto_optimize_routes && !settings?.auto_optimize_route) return

  const { count } = await admin
    .from("route_stops")
    .select("id", { count: "exact", head: true })
    .eq("route_id", routeId)
    .eq("company_id", companyId)

  if ((count ?? 0) < 2) return

  const { optimizeMultiStopRoute } = await import("./route-optimization")
  const result = await optimizeMultiStopRoute(routeId)
  if (!result.optimized && result.error) {
    Sentry.captureMessage(`[maybeAutoOptimizeRoute] ${result.error}`, {
      level: "warning",
      extra: { routeId, companyId },
    })
  }
}
