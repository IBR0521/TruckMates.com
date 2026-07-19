import { getExpenses } from "@/app/actions/accounting"
import ExpensesPageClient from "./expenses-page-client"

export const dynamic = "force-dynamic"

/**
 * Server wrapper: fetch expenses during SSR so the list paints with data instead of a
 * skeleton + client round-trip. The client seeds its state from these props and does a
 * silent background refresh. See app/dashboard/loads/page.tsx.
 */
export default async function ExpensesPage() {
  const initial = await getExpenses()

  return (
    <ExpensesPageClient
      initialExpenses={(initial.data as unknown[]) ?? null}
      initialError={initial.error ?? null}
    />
  )
}
