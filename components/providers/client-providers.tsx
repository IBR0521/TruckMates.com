"use client"

import React from "react"
import dynamic from "next/dynamic"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"

// Dynamically import all client components with ssr: false
const QueryProvider = dynamic(
  () => import("@/components/providers/query-provider").then(mod => ({ default: mod.QueryProvider })),
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

interface ClientProvidersProps {
  children: React.ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
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

