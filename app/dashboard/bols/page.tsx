import { getBOLs } from "@/app/actions/bol"
import BOLsPageClient from "./bols-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch the unfiltered first page of BOLs during SSR so the list paints with
 * data instead of a skeleton + client round-trip. Matches the client's default (status "all",
 * no search). The client seeds its state from these props, then background-refreshes (and
 * loads the stats widget) on mount. See app/dashboard/loads/page.tsx.
 */
export default async function BOLsPage() {
  const initial = await getBOLs({})

  return (
    <BOLsPageClient
      initialBOLs={(initial.data as unknown[]) ?? null}
      initialError={initial.error ?? null}
    />
  )
}
