"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { getBillingPlanContext } from "@/app/actions/plan-usage"

export function TrialHeaderBadge() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let a = true
    void getBillingPlanContext().then((r) => {
      if (!a || !r.data) return
      const trialing = String(r.data.subscription_status) === "trial"
      const ends = r.data.trial_ends_at ? new Date(r.data.trial_ends_at).getTime() : null
      setShow(Boolean(trialing && ends !== null && ends > Date.now()))
    })
    return () => {
      a = false
    }
  }, [])

  if (!show) return null

  return (
    <Badge variant="secondary" className="hidden sm:inline-flex font-normal whitespace-nowrap text-xs border-primary/40">
      14-day trial active
    </Badge>
  )
}
