"use client"

import React from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

const QueryProvider = dynamic(
  () =>
    import("@/components/providers/query-provider").then((mod) => ({
      default: mod.QueryProvider,
    })),
  { ssr: false }
)

const ThemeProvider = dynamic(
  () =>
    import("@/components/theme-provider").then((mod) => ({
      default: mod.ThemeProvider,
    })),
  { ssr: false }
)

const KeyboardShortcutsProvider = dynamic(
  () =>
    import("@/components/keyboard-shortcuts").then((mod) => ({
      default: mod.KeyboardShortcutsProvider,
    })),
  { ssr: false }
)

const GlobalSearch = dynamic(
  () =>
    import("@/components/global-search").then((mod) => ({
      default: mod.GlobalSearch,
    })),
  { ssr: false }
)

const Toaster = dynamic(
  () => import("sonner").then((mod) => ({ default: mod.Toaster })),
  { ssr: false }
)

interface ClientProvidersProps {
  children: React.ReactNode
}

/** Routes that need React Query, theme context, shortcuts, and global search */
function useIsAppShellRoute() {
  const pathname = usePathname()
  if (!pathname) return false
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/marketplace/dashboard") ||
    pathname.startsWith("/account-setup") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/tracking")
  )
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const isAppShellRoute = useIsAppShellRoute()

  // Public/marketing: minimal shell (no React Query / theme bundle).
  if (!isAppShellRoute) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  // App shell: single stable tree from the first client render.
  // Do NOT gate ThemeProvider on a "mounted" flag — that swapped the React tree after one tick,
  // remounted the whole dashboard, re-ran effects (setup checks, React Query), and felt like a full reload.
  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <KeyboardShortcutsProvider>
          {children}
          <GlobalSearch />
        </KeyboardShortcutsProvider>
      </ThemeProvider>
      <Toaster />
    </QueryProvider>
  )
}
