"use client"

import React from "react"
import dynamic from "next/dynamic"

// Dynamically import all client components with ssr: false to prevent SSR issues
const QueryProvider = dynamic(
  () => import("@/components/providers/query-provider").then(mod => ({ default: mod.QueryProvider })),
  { ssr: false }
)

const ThemeProvider = dynamic(
  () => import("@/components/theme-provider").then(mod => ({ default: mod.ThemeProvider })),
  { ssr: false }
)

const KeyboardShortcutsProvider = dynamic(
  () => import("@/components/keyboard-shortcuts").then(mod => ({ default: mod.KeyboardShortcutsProvider })),
  { ssr: false }
)

const GlobalSearch = dynamic(
  () => import("@/components/global-search").then(mod => ({ default: mod.GlobalSearch })),
  { ssr: false }
)

const Toaster = dynamic(
  () => import("sonner").then(mod => ({ default: mod.Toaster })),
  { ssr: false }
)

interface ClientProvidersProps {
  children: React.ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render providers until mounted (client-side only)
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <KeyboardShortcutsProvider>
          {children}
          <GlobalSearch />
        </KeyboardShortcutsProvider>
        <Toaster />
      </ThemeProvider>
    </QueryProvider>
  )
}

