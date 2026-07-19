import { getDocuments } from "@/app/actions/documents"
import DocumentsPageClient from "./documents-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch documents during SSR so the list paints with data instead of a
 * skeleton + client round-trip. The client seeds its state from these props and does a
 * silent background refresh (and separately loads the expiring-items banner client-side).
 * See app/dashboard/loads/page.tsx.
 */
export default async function DocumentsPage() {
  const initial = await getDocuments()

  return (
    <DocumentsPageClient
      initialDocuments={(initial.data as unknown[]) ?? null}
      initialError={initial.error ?? null}
    />
  )
}
