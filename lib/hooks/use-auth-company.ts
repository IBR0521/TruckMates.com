"use client"

import { useQuery } from "@tanstack/react-query"
import { getAuthCompany } from "@/lib/auth/server"

/**
 * Current user's company id and name.
 * Used to scope dashboard and other data by company so different accounts see only their data.
 */
export function useAuthCompany() {
  return useQuery({
    queryKey: ["auth", "company"],
    queryFn: async () => {
      const result = await getAuthCompany()
      if (result.error) throw new Error(result.error)
      return { companyId: result.companyId, companyName: result.companyName }
    },
    staleTime: 5 * 60 * 1000, // 5 min - identity changes rarely
    retry: 1,
  })
}
