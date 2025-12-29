"use client"

import { useState, useEffect } from "react"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always render children - React Query is optional and not required
  // If needed in the future, install @tanstack/react-query and uncomment the code below
  if (!mounted) {
    return <>{children}</>
  }

  return <>{children}</>
  
  /* 
  // Optional React Query support - uncomment if @tanstack/react-query is installed
  const [hasReactQuery, setHasReactQuery] = useState(false)
  const [QueryClientProvider, setQueryClientProvider] = useState<any>(null)
  const [queryClient, setQueryClient] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Dynamically load React Query only if available
      const loadReactQuery = async () => {
        try {
          const reactQuery = await import("@tanstack/react-query")
          const { QueryClient, QueryClientProvider: QCP } = reactQuery
          
          setQueryClientProvider(() => QCP)
          setQueryClient(
            new QueryClient({
              defaultOptions: {
                queries: {
                  staleTime: 30 * 1000,
                  gcTime: 5 * 60 * 1000,
                  retry: 1,
                  refetchOnWindowFocus: true,
                },
              },
            })
          )
          setHasReactQuery(true)
        } catch {
          setHasReactQuery(false)
        }
      }
      loadReactQuery()
    }
  }, [])

  if (!mounted || !hasReactQuery || !QueryClientProvider || !queryClient) {
    return <>{children}</>
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  */
}
