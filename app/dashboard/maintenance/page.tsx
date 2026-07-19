import { Suspense } from "react"
import { getMaintenance } from "@/app/actions/maintenance"
import MaintenancePageClient from "./maintenance-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch maintenance records during SSR so the list paints with data instead
 * of a skeleton + client round-trip. The client seeds its state from these props and does a
 * silent background refresh. Suspense wraps the client because it reads useSearchParams().
 * See app/dashboard/loads/page.tsx.
 */
export default async function MaintenancePage() {
  const initial = await getMaintenance()

  return (
    <Suspense>
      <MaintenancePageClient
        initialMaintenance={(initial.data as unknown[]) ?? null}
        initialError={initial.error ?? null}
      />
    </Suspense>
  )
}
