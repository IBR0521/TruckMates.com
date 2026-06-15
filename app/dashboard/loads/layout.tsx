import { LoadsInitialDataProvider } from "@/components/dashboard/initial-list-data-contexts"

export const dynamic = "force-dynamic"

/** List page fetches client-side; avoid blocking load detail / edit routes with getLoads(). */
export default function LoadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoadsInitialDataProvider value={{ initialLoads: null, initialError: null }}>
      {children}
    </LoadsInitialDataProvider>
  )
}
