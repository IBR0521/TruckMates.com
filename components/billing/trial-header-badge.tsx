"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { useDashboardShell } from "@/components/dashboard/shell-bootstrap-provider"

export function TrialHeaderBadge() {
  const shell = useDashboardShell()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!shell.data?.billing) return
    const trialing = String(shell.data.billing.subscription_status) === "trial"
    const ends = shell.data.billing.trial_ends_at
      ? new Date(shell.data.billing.trial_ends_at).getTime()
      : null
    setShow(Boolean(trialing && ends !== null && ends > Date.now()))
  }, [shell.data])

  if (!show) return null

  return (
    <Badge variant="secondary" className="hidden sm:inline-flex font-normal whitespace-nowrap text-xs border-primary/40">
      14-day trial active
    </Badge>
  )
}
