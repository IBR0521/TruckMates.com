import { getInvoices } from "@/app/actions/accounting"
import InvoicesPageClient from "./invoices-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch invoices during SSR so the list paints with data instead of a
 * skeleton + client round-trip. The client seeds its state from these props and does a
 * silent background refresh for freshness. See app/dashboard/loads/page.tsx.
 */
export default async function InvoicesPage() {
  const initial = await getInvoices()

  return (
    <InvoicesPageClient
      initialInvoices={(initial.data as unknown[]) ?? null}
      initialError={initial.error ?? null}
    />
  )
}
