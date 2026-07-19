import { getCustomers } from "@/app/actions/customers"
import CustomersPageClient from "./customers-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch the unfiltered first page of customers during SSR so the list
 * paints with data instead of a skeleton + client round-trip. Matches the client's default
 * (no search/status/type filter) so the background refresh returns the same set. The client
 * seeds its state from these props. See app/dashboard/loads/page.tsx.
 */
export default async function CustomersPage() {
  const initial = await getCustomers({})

  return (
    <CustomersPageClient
      initialCustomers={initial.data ?? null}
      initialError={initial.error ?? null}
    />
  )
}
