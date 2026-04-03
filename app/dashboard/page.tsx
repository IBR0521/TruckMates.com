import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import FleetDashboardPage from "@/components/dashboard/fleet-dashboard-page"
import { DriverDashboardPage } from "@/components/dashboard/driver-dashboard-page"

/**
 * Server chooses dashboard by role so drivers never mount the fleet/financial dashboard tree.
 */
export default async function DashboardPage() {
  const ctx = await getCachedAuthContext()
  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null

  if (role === "driver") {
    return <DriverDashboardPage />
  }

  return <FleetDashboardPage />
}
