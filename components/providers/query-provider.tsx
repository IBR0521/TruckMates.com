"use client"

import React, { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Create a client instance with optimized defaults for better performance
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 60 seconds - data is fresh for 60s (reduced refetching)
        gcTime: 10 * 60 * 1000, // 10 minutes - cache persists longer
        retry: 1, // Retry once on failure
        refetchOnWindowFocus: false, // Don't refetch on focus (better performance)
        refetchOnReconnect: true, // Refetch when connection is restored
        refetchOnMount: false, // Don't refetch on mount if data is fresh (better performance)
        refetchInterval: false, // Disable automatic refetching (use manual intervals)
      },
      mutations: {
        retry: 0, // Don't retry mutations
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: use singleton pattern to keep the same query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  // Use lazy initialization to ensure React is available
  // Defensive check: Ensure React is available before using hooks
  // During static generation, React might not be fully initialized
  try {
    const [queryClient] = useState(() => {
      return getQueryClient()
    })

    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  } catch (error) {
    // If React hooks fail (e.g., during static generation), return children without provider
    // This allows static pages to be generated without React Query
    console.warn('[QueryProvider] Failed to initialize, skipping provider:', error)
    return <>{children}</>
  }
}
