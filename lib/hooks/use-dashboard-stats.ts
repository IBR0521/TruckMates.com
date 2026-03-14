/**
 * React Query hook for dashboard stats
 * Scoped by company so different accounts never see each other's cached data.
 */

import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/app/actions/dashboard"
import { useAuthCompany } from "./use-auth-company"

export function useDashboardStats() {
  const { data: authCompany } = useAuthCompany()
  const companyId = authCompany?.companyId ?? null

  return useQuery({
    queryKey: ["dashboard", "stats", companyId],
    queryFn: async () => {
      const result = await getDashboardStats()
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: companyId != null,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  })
}
