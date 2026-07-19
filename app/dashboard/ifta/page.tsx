import { Suspense } from "react"
import { getIFTAReports } from "@/app/actions/tax-fuel-reconciliation"
import IFTAPageClient from "./ifta-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch IFTA reports during SSR so the list paints with data instead of a
 * skeleton + client round-trip. The client seeds its state from these props and does a
 * silent background refresh. Suspense wraps the client because it reads useSearchParams().
 * See app/dashboard/loads/page.tsx.
 */
export default async function IFTAPage() {
  const initial = await getIFTAReports()

  return (
    <Suspense>
      <IFTAPageClient
        initialReports={(initial.data as unknown[]) ?? null}
        initialError={initial.error ?? null}
      />
    </Suspense>
  )
}
