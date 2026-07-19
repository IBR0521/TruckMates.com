import { getLoads } from "@/app/actions/loads"
import { LoadsInitialDataProvider } from "@/components/dashboard/initial-list-data-contexts"
import LoadsPageClient from "./loads-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch the first page of loads during SSR and hydrate the client list,
 * so the page paints with data instead of a skeleton + client round-trip. Scoped to the
 * list route only (not the shared layout) so /loads/[id] detail & edit aren't blocked by
 * getLoads(). Mirrors the pattern in app/dashboard/page.tsx and drivers/layout.tsx.
 * Matches the client's default first fetch (sortBy created_at, limit 25) so the background
 * refresh returns the same shape with no visible reflow.
 */
export default async function LoadsPage() {
  const initial = await getLoads({ sortBy: "created_at", limit: 25, offset: 0 })

  return (
    <LoadsInitialDataProvider
      value={{ initialLoads: initial.data ?? [], initialError: initial.error ?? null }}
    >
      <LoadsPageClient />
    </LoadsInitialDataProvider>
  )
}
