import { getDVIRs } from "@/app/actions/dvir"
import DVIRPageClient from "./dvir-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch the first page of DVIRs during SSR so the list paints with data
 * instead of a skeleton + client round-trip. Matches the client's default first fetch
 * (all statuses/types, limit 25, offset 0). The client seeds its state from these props,
 * then background-refreshes (and loads stats + open-defect trucks) on mount.
 * See app/dashboard/loads/page.tsx.
 */
export default async function DVIRPage() {
  const initial = await getDVIRs({ limit: 25, offset: 0 })

  return (
    <DVIRPageClient
      initialDVIRs={(initial.data as unknown[]) ?? null}
      initialError={initial.error ?? null}
    />
  )
}
