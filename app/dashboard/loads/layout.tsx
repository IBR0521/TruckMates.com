import { getLoads } from "@/app/actions/loads"
import { LoadsInitialDataProvider } from "@/components/dashboard/initial-list-data-contexts"

export const dynamic = "force-dynamic"

export default async function LoadsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initial = await getLoads({
    sortBy: "created_at",
    limit: 25,
    offset: 0,
  })

  return (
    <LoadsInitialDataProvider
      value={{
        initialLoads: initial.data || [],
        initialError: initial.error || null,
      }}
    >
      {children}
    </LoadsInitialDataProvider>
  )
}
