import { getSettlements } from "@/app/actions/accounting"
import { getDrivers } from "@/app/actions/drivers"
import SettlementsPageClient from "./settlements-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch settlements + the driver filter options during SSR (in parallel)
 * so the list paints with data instead of a skeleton + client round-trip. The client seeds
 * its state from these props and does a silent background refresh. See app/dashboard/loads/page.tsx.
 */
export default async function SettlementsPage() {
  const [settlements, drivers] = await Promise.all([getSettlements(), getDrivers()])

  return (
    <SettlementsPageClient
      initialSettlements={(settlements.data as unknown[]) ?? null}
      initialDrivers={(drivers.data as unknown[]) ?? null}
      initialError={settlements.error ?? null}
    />
  )
}
