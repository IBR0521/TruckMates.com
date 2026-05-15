"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FeatureLock } from "@/components/billing/feature-lock"
import { getFaultCodeHistory, type FaultCode } from "@/app/actions/fault-codes"

export function TruckFaultCodesSection({ truckId }: { truckId: string }) {
  const [rows, setRows] = useState<FaultCode[]>([])

  useEffect(() => {
    let alive = true
    void getFaultCodeHistory({ truckId, daysBack: 90, includeResolved: true }).then((r) => {
      if (!alive) return
      setRows((r.data ?? []).slice(0, 20))
    })
    return () => {
      alive = false
    }
  }, [truckId])

  return (
    <FeatureLock
      featureKey="eld_fault_codes_basic"
      title="Fault codes"
      description="ECM fault history for this truck from connected ELD telemetry."
    >
      <Card className="border-border/70 bg-card/80 p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Fault code history</h3>
          <Link href="/dashboard/eld/health" className="text-sm text-primary hover:underline">
            Fleet health
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fault codes recorded for this truck.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0"
              >
                <span className="font-mono text-xs">{r.code}</span>
                <span className="truncate text-muted-foreground max-w-[240px]">
                  {r.description ?? "—"}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {r.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {r.resolved_at
                    ? `Resolved ${new Date(r.resolved_at).toLocaleDateString()}`
                    : r.is_active
                      ? "Active"
                      : "Cleared"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </FeatureLock>
  )
}
