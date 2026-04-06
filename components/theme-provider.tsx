"use client"

import * as React from "react"

const STORAGE_KEY = "theme"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme | undefined
  setTheme: (theme: string) => void
  resolvedTheme: Theme
  themes: string[]
  systemTheme?: Theme
  forcedTheme?: Theme
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

function applyDomTheme(next: Theme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(next)
  root.style.colorScheme = next
}

export type AppThemeProviderProps = {
  children: React.ReactNode
  /** Only `class` is supported (matches prior next-themes usage). */
  attribute?: "class"
  defaultTheme?: string
  enableSystem?: boolean
}

/**
 * React-19-safe theme context (no inline `<script>` in the tree).
 * next-themes does that for FOUC; we rely on `className="dark"` on `<html>` in layout for first paint.
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
  enableSystem: _enableSystem = false,
}: AppThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme | undefined>(undefined)
  const [resolvedTheme, setResolvedTheme] = React.useState<Theme>(
    defaultTheme === "light" ? "light" : "dark",
  )

  React.useEffect(() => {
    let initial: Theme = defaultTheme === "light" ? "light" : "dark"
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "light" || stored === "dark") initial = stored
    } catch {
      /* ignore */
    }
    setThemeState(initial)
    setResolvedTheme(initial)
    applyDomTheme(initial)
  }, [defaultTheme])

  const setTheme = React.useCallback((next: string) => {
    const t: Theme = next === "light" ? "light" : "dark"
    setThemeState(t)
    setResolvedTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
    applyDomTheme(t)
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      themes: ["light", "dark"],
      systemTheme: undefined,
      forcedTheme: undefined,
    }),
    [theme, setTheme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** Drop-in replacement for next-themes `useTheme` for this app. */
export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: undefined,
      setTheme: () => {},
      resolvedTheme: "dark",
      themes: ["light", "dark"],
      systemTheme: undefined,
      forcedTheme: undefined,
    }
  }
  return ctx
}
