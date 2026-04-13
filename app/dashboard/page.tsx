import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import FleetDashboardPage from "@/components/dashboard/fleet-dashboard-page"
import { DriverDashboardPage } from "@/components/dashboard/driver-dashboard-page"
import { getDashboardBootstrap } from "@/app/actions/dashboard"

/**
 * Server chooses dashboard by role so drivers never mount the fleet/financial dashboard tree.
 */
export default async function DashboardPage() {
  const ctx = await getCachedAuthContext()
  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null

  if (role === "driver") {
    return <DriverDashboardPage />
  }

  const bootstrap = await getDashboardBootstrap()
  const initialBootstrap = bootstrap.dashboardData
    ? {
        authCompany: bootstrap.authCompany,
        userRole: bootstrap.userRole,
        dashboardData: bootstrap.dashboardData,
        driverDashboard: null,
      }
    : null

  return (
    <FleetDashboardPage
      initialBootstrap={initialBootstrap}
      initialSessionUserId={ctx.userId ?? null}
    />
  )
}
