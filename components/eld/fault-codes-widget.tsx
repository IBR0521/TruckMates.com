"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getFaultCodeStats } from "@/app/actions/fault-codes"
import { AlertTriangle, ArrowRight } from "lucide-react"

export function FaultCodesWidget() {
  const [critical, setCritical] = useState(0)
  const [high, setHigh] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getFaultCodeStats({ daysBack: 30 }).then((r) => {
      if (!alive) return
      if (r.error) setErr(r.error)
      else {
        setCritical(r.data?.by_severity?.critical ?? 0)
        setHigh(r.data?.by_severity?.high ?? 0)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <FeatureLock
      featureKey="eld_fault_codes_basic"
      title="Engine fault codes"
      description="ECM fault visibility from connected ELDs. Pro adds translations and auto-maintenance for critical codes."
    >
      <Card
        className={`border-border/70 bg-card/80 p-4 md:p-6 ${critical > 0 ? "border-red-500/40" : ""}`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-5 w-5 ${critical > 0 ? "text-red-500" : "text-primary"}`}
            />
            <h3 className="text-lg font-semibold">Active fault codes</h3>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/eld/health" className="text-xs">
              View all <ArrowRight className="h-3 w-3 ml-1 inline" />
            </Link>
          </Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!err && (
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Critical</p>
              <p className={`text-2xl font-bold ${critical > 0 ? "text-red-600" : ""}`}>{critical}</p>
            </div>
            <div>
              <p className="text-muted-foreground">High</p>
              <p className={`text-2xl font-bold ${high > 0 ? "text-orange-600" : ""}`}>{high}</p>
            </div>
          </div>
        )}
      </Card>
    </FeatureLock>
  )
}
