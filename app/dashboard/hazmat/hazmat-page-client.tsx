"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getHazmatLoads } from "@/app/actions/hazmat-loads"
import { driverHasHazmatEndorsement } from "@/lib/compliance-readiness"
import { toast } from "sonner"

type HazmatLoad = {
  id: string
  shipment_number?: string | null
  status?: string | null
  origin?: string | null
  destination?: string | null
  un_number?: string | null
  hazard_class?: string | null
  proper_shipping_name?: string | null
  drivers?: { name?: string | null; license_endorsements?: unknown } | null
}

export function HazmatPageClient() {
  const [loads, setLoads] = useState<HazmatLoad[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const result = await getHazmatLoads()
      if (result.error) toast.error(result.error)
      else setLoads((result.data || []) as HazmatLoad[])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">HAZMAT loads</h1>
      <p className="text-sm text-muted-foreground">
        Active hazardous shipments with endorsement and shipping-paper compliance status.
      </p>
      <Card className="p-4 border-border">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : loads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active HAZMAT loads.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {loads.map((load) => {
              const endorsed = driverHasHazmatEndorsement(load.drivers?.license_endorsements)
              const docsOk = Boolean(load.un_number && load.hazard_class && load.proper_shipping_name)
              return (
                <li key={load.id} className="py-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <Link href={`/dashboard/loads/${load.id}`} className="font-medium hover:underline">
                      {load.shipment_number || load.id}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {load.origin} → {load.destination} · UN {load.un_number || "—"} · Class {load.hazard_class || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{load.proper_shipping_name || "Missing shipping name"}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={endorsed ? "default" : "destructive"}>
                      {endorsed ? "H endorsement" : "No H endorsement"}
                    </Badge>
                    <Badge variant={docsOk ? "secondary" : "destructive"}>
                      {docsOk ? "Papers OK" : "Papers incomplete"}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
