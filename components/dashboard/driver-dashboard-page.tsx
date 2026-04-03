"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { DriverDashboardHome } from "@/components/dashboard/driver-dashboard-home"
import { getDriverDashboardSnapshot } from "@/app/actions/driver-dashboard"
import { useDashboardPageData } from "@/lib/hooks/use-dashboard-page"

/**
 * Driver-only home: compliance snapshot (HOS, load, DVIR, violations).
 * Routed from server `app/dashboard/page.tsx` when role is `driver` — fleet UI is not in this bundle path.
 *
 * Bootstrap caches for minutes; HOS must stay in sync with ELD — we refetch snapshot on an interval + focus.
 */
export function DriverDashboardPage() {
  const { data, isLoading, error, sessionUserId } = useDashboardPageData()

  const liveSnapshot = useQuery({
    queryKey: ["driverDashboardSnapshot", sessionUserId],
    queryFn: async () => {
      const r = await getDriverDashboardSnapshot()
      if (r.error) throw new Error(r.error)
      return r.data
    },
    enabled: !!sessionUserId && data?.userRole === "driver",
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 45_000,
  })

  const authCompany = data?.authCompany ?? null
  const driverDashboard = liveSnapshot.data ?? data?.driverDashboard ?? null

  if (error) {
    return (
      <div className="w-full p-4 md:p-8">
        <Card className="max-w-lg mx-auto p-6">
          <p className="text-destructive text-sm font-medium">Could not load your dashboard</p>
          <p className="text-muted-foreground text-sm mt-2">{error.message}</p>
        </Card>
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <div className="w-full p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-secondary animate-pulse rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="h-4 bg-secondary animate-pulse rounded w-24 mb-2" />
                <div className="h-8 bg-secondary animate-pulse rounded w-32" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return <DriverDashboardHome snapshot={driverDashboard} companyName={authCompany?.companyName} />
}
