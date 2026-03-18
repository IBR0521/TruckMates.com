import type React from "react"

// Server component wrapper for dashboard layout
// Exports route segment config to force dynamic rendering
// This prevents static generation which causes React hooks errors

export const dynamic = "force-dynamic"
export const revalidate = 0

import DashboardLayoutClient from "./layout-client"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}

