import { getTrucks } from "@/app/actions/trucks"
import TrucksPageClient from "./trucks-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch trucks during SSR so the list paints with data instead of a
 * skeleton + client round-trip. The client seeds its state from these props and does a
 * silent background refresh for freshness. See app/dashboard/loads/page.tsx.
 */
export default async function TrucksPage() {
  const initial = await getTrucks()

  return (
    <TrucksPageClient
      initialTrucks={initial.data ?? null}
      initialError={initial.error ?? null}
    />
  )
}
