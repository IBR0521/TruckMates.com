import { Suspense } from "react"
import { getUnassignedLoads, getUnassignedRoutes } from "@/app/actions/dispatches"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { getTerminals } from "@/app/actions/terminals"
import DispatchesPageClient from "./dispatches-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch the dispatch board's data (unassigned loads/routes, active drivers,
 * available trucks, terminals) during SSR — in parallel — so the board paints populated
 * instead of a skeleton + a client round-trip. Uses the unfiltered ("all" terminals) set to
 * match the client's default state; the client seeds from these props, then keeps itself fresh
 * via its background refresh + realtime subscriptions. HOS data stays client-loaded (it polls).
 * Suspense wraps the client because it reads useSearchParams(). See app/dashboard/loads/page.tsx.
 */
export default async function DispatchesPage() {
  const [loads, routes, drivers, trucks, terminals] = await Promise.all([
    getUnassignedLoads(),
    getUnassignedRoutes(),
    getDrivers(),
    getTrucks({ limit: 100 }),
    getTerminals(),
  ])

  return (
    <Suspense>
      <DispatchesPageClient
        initialLoads={(loads.data as unknown[]) ?? null}
        initialRoutes={(routes.data as unknown[]) ?? null}
        initialDrivers={(drivers.data as unknown[]) ?? null}
        initialTrucks={(trucks.data as unknown[]) ?? null}
        initialTerminals={(terminals.data as unknown[]) ?? null}
      />
    </Suspense>
  )
}
