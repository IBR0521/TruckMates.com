"use client"

import { useQuery } from "@tanstack/react-query"
import { getDashboardBootstrap } from "@/app/actions/dashboard"

/**
 * Single request for dashboard home (company + stats). Avoids the previous waterfall:
 * useAuthCompany → then useDashboardStats (two round-trips).
 */
export function useDashboardPageData() {
  return useQuery({
    queryKey: ["dashboard", "bootstrap"],
    queryFn: async () => {
      const r = await getDashboardBootstrap()
      if (r.dashboardError) {
        throw new Error(r.dashboardError)
      }
      if (!r.dashboardData) {
        throw new Error("No dashboard data")
      }
      return {
        authCompany: r.authCompany,
        dashboardData: r.dashboardData,
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  })
}
