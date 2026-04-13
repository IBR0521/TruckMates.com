"use client"

import { useQuery } from "@tanstack/react-query"
import { getDashboardBootstrap } from "@/app/actions/dashboard"
import { createClient } from "@/lib/supabase/client"
import type { EmployeeRole } from "@/lib/roles"
import type { DriverDashboardSnapshot } from "@/lib/types/driver-dashboard"
import type { DashboardStats } from "@/lib/types/dashboard-stats"

export type DashboardBootstrapResult = {
  authCompany: { companyId: string; companyName: string | null } | null
  userRole: EmployeeRole | null
  dashboardData: DashboardStats | null
  driverDashboard: DriverDashboardSnapshot | null
}

/**
 * Single request for dashboard home (company + stats or driver snapshot).
 * Query key includes auth user id so switching accounts never shows cached data from another user.
 */
export function useDashboardPageData(
  initialBootstrap: DashboardBootstrapResult | null = null,
  initialSessionUserId: string | null = null
) {
  const supabase = createClient()

  const sessionQuery = useQuery({
    queryKey: ["auth", "sessionUserId"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user?.id ?? null
    },
    enabled: !initialSessionUserId,
    staleTime: 5 * 60 * 1000,
  })

  const sessionUserId = initialSessionUserId ?? sessionQuery.data ?? null

  const bootstrapQuery = useQuery({
    queryKey: ["dashboard", "bootstrap", sessionUserId],
    initialData: initialBootstrap ?? undefined,
    queryFn: async () => {
      const r = await getDashboardBootstrap()
      if (r.dashboardError) {
        throw new Error(r.dashboardError)
      }
      if (r.userRole === "driver") {
        return {
          authCompany: r.authCompany,
          userRole: r.userRole,
          dashboardData: null,
          driverDashboard: r.driverDashboard ?? null,
        } satisfies DashboardBootstrapResult
      }
      if (!r.dashboardData) {
        throw new Error("No dashboard data")
      }
      return {
        authCompany: r.authCompany,
        userRole: r.userRole,
        dashboardData: r.dashboardData,
        driverDashboard: null,
      } satisfies DashboardBootstrapResult
    },
    enabled: !!sessionUserId,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
    // If server already hydrated initial dashboard payload, avoid immediate duplicate request.
    refetchOnMount: initialBootstrap ? false : true,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
  })

  const isLoading =
    sessionQuery.isLoading || (!!sessionUserId && (bootstrapQuery.isPending || bootstrapQuery.isLoading))

  return {
    ...bootstrapQuery,
    isLoading,
    /** For driver-only queries (e.g. fresh HOS) keyed to the signed-in user */
    sessionUserId,
  }
}
