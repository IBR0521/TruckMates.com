"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  getDashboardShellBootstrap,
  type DashboardShellBootstrap,
} from "@/app/actions/dashboard-shell"

type ShellState = {
  data: DashboardShellBootstrap | null
  loading: boolean
  error: string | null
}

const DashboardShellContext = createContext<ShellState>({
  data: null,
  loading: true,
  error: null,
})

export function DashboardShellProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShellState>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    void getDashboardShellBootstrap()
      .then((res) => {
        if (!active) return
        if (res.error || !res.data) {
          setState({ data: null, loading: false, error: res.error || "Failed to load dashboard" })
          return
        }
        setState({ data: res.data, loading: false, error: null })
      })
      .catch(() => {
        if (active) setState({ data: null, loading: false, error: "Failed to load dashboard" })
      })
    return () => {
      active = false
    }
  }, [])

  return <DashboardShellContext.Provider value={state}>{children}</DashboardShellContext.Provider>
}

export function useDashboardShell() {
  return useContext(DashboardShellContext)
}
