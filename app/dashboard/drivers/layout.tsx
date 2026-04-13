import { getDrivers } from "@/app/actions/drivers"
import { DriversInitialDataProvider } from "@/components/dashboard/initial-list-data-contexts"

export default async function DriversLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initial = await getDrivers({
    sortBy: "name",
    limit: 25,
    offset: 0,
  })

  return (
    <DriversInitialDataProvider
      value={{
        initialDrivers: initial.data || [],
        initialCount: typeof initial.count === "number" ? initial.count : 0,
        initialError: initial.error || null,
      }}
    >
      {children}
    </DriversInitialDataProvider>
  )
}
